const http = require('http');
const url = require('url');
const fs = require('fs');
const port = 3000;

var index = fs.readFileSync(__dirname + "/../index.html");
var scriptFile = fs.readFileSync(__dirname + "/../client/client.js");
var cssFile = fs.readFileSync(__dirname + "/../main.css");
const mediaStatus = {
    cur: "CURRENT",
    pla: "PLANNING",
    com: "COMPLETED",
    drop: "DROPPED",
    pause: "PAUSED",
    repeat: "REPEATING"
};
const scoreFormat = [
    {name: "POINT_100", half: 50},
    {name: "POINT_10_DECIMAL", half: 5},
    {name: "POINT_10", half: 5},
    {name: "POINT_5", half: 3 },
    {name: "POINT_3", half: 2 }
]


function onRequest(req, res) {
    var pathObj = url.parse(req.url, true);
    var params = pathObj.query;

    if (pathObj.pathname === "/") {
        res.writeHead(200, {"Content-Type" : "text/html"});
        res.write(index);
        res.end();
    }

    if(pathObj.pathname === "/userSearch") {
        res = userSearch(req, res, params);
    }
    if (pathObj.pathname === "/client/client.js") {
        res.writeHead(200, {"Content-Type": "text/javascript"});
        res.write(scriptFile);
        res.end();
    }
    if(pathObj.pathname === "/main.css") {
        res.writeHead(200, {"Content-Type": "text/css"});
        res.write(cssFile);
        res.end();
    }
}

function userSearch(req, res, params) {
    var queryString = `
        query($id: String) {
            MediaListCollection(userName: $id, type: ANIME) {
                user {
                    mediaListOptions {
                      scoreFormat
                    }
                }
                lists {
                    status
                    entries {
                      score
                      media {
                        id
                        title {
                            english
                            romaji
                        }
                        recommendations(sort: RATING_DESC) {
                          edges {
                            node {
                              mediaRecommendation {
                                id
                              }
                              rating
                            }
                          }
                        }
                      }
                    }
                  }
            }
        }
    `

    var variables = {
        id: params.term
    };

    var url = `https://graphql.anilist.co`,
        options ={
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: queryString,
                variables: variables
            })
        };
    fetch(url, options).then(handleResponse)
                       .then(handleData)
                       .catch(handleError)
    return res;

    function handleError(error) {
        console.log(error);
        res.writeHead(500, {'Content-Type': 'application/json'});
        var responseMessage = {
            message: "Failed to connect to anilist. Check Username info and try again",
            error: error
        };

        res.write(JSON.stringify(responseMessage));
        res.end();
    }

    function handleResponse(response) {
        console.log(response);
        return response.json().then(function (json) {
            return response.ok ? json : Promise.reject();
        });
    }
    
    async function handleData(data) {
        //get the lists of the users anime which are split into categories
        var userLists = data.data.MediaListCollection.lists;
        //For calculation sake we need to find what type of score this user has
        var formatHalf = scoreFormat.find((format) => format.name === data.data.MediaListCollection.user.mediaListOptions.scoreFormat).half;
        //Start with statuses we want to include, we always want to include completed and rewatching
        var statusToAllow = [mediaStatus.com, mediaStatus.repeat];
        //based on certain params, add more lists
        if(params.watching) statusToAllow.push(mediaStatus.cur);
        if(params.dropped) statusToAllow.push(mediaStatus.drop);
        if(params.paused) statusToAllow.push(mediaStatus.pause);
        var entries = [];
        //for each status to allow, filter down to the exact list, then get its entries and concat it onto entries
        statusToAllow.forEach((listStatus) => {
            var entriesToAdd = userLists.find((list) => {
                return list.status === listStatus;
            })
            if(entriesToAdd != null) {

                entries.push(...entriesToAdd.entries)
            }
        })
        /**
         * {
         *    id: ###
         *    totalRating: ###
         * }
         */
        var recs = [];
        //Iterate through the enteries
        for(var i = 0; i < entries.length; i++) {
            var score = entries[i].score;
            //if the score is zero assume it isn't rated, also if its a half score we ignore it
            if (score === 0 || score === formatHalf) {
                continue;
            }
            var totalUpvotes = 0;
            //Grab the array of recommendations
            var recommendations = entries[i].media.recommendations.edges;
            //Iterate through the recommendations
            for(var j = 0; j < recommendations.length; j++) {
                //If the rec has a 0 or sub zero rating ignore it also sometimes it just has a recommendation of null?
                if (recommendations[j].node.rating <= 0 || recommendations[j].node.mediaRecommendation === null) {
                    continue;
                }
                //Add up all the recs to get some math
                totalUpvotes += recommendations[j].node.rating;
            }   
            //If the total number of upvotes is less than or equal to the number of recs that we should probably just ignore them. Same if there are less than 10 total upvotes, it breaks the math
            if (totalUpvotes <= recommendations.length || totalUpvotes < 10) {
                continue;
            }
            //Now iterate through the recs for real
            for (var j = 0; j < recommendations.length; j++) {
                //ignore this if the rating is les than zero, or if the recommendation is null
                if (recommendations[j].node.rating <= 0 ||  recommendations[j].node.mediaRecommendation === null) {
                    continue;
                }
                var existingRec = null;
                //If the rec array already has stuff and it already exists we should add to it
                if(recs.length > 0) {
                    existingRec = recs.find((e) => e.id === recommendations[j].node.mediaRecommendation.id);
                    if (existingRec != null) {
                        existingRec.rating += calculateRating(score, recommendations[j].node.rating, totalUpvotes, formatHalf);
                        existingRec.sources.push({englishName: entries[i].media.title.english, romajiName: entries[i].media.title.romaji, upvotes: recommendations[j].node.rating, totalUpvotes: totalUpvotes, score: score})
                    }
                }
                //If there is no recs or it hasn't been added yet, add it
                if (existingRec == null || recs.length === 0) {
                    recs.push({
                        id: recommendations[j].node.mediaRecommendation.id,
                        rating: calculateRating(score, recommendations[j].node.rating, totalUpvotes, formatHalf),
                        sources: [{englishName: entries[i].media.title.english, romajiName: entries[i].media.title.romaji, upvotes: recommendations[j].node.rating, totalUpvotes: totalUpvotes, score: score}]
                    })
                }
            }
         }
         //Take the results of the recs and remove any below 0 recs, then remove an entries which already are on completed, then sort by rating, then cut to just the top 200
        var results = recs.filter((rec) => rec.rating > 0)
        .filter((rec) => entries.find((entry) => entry.media.id === rec.id) == null)
        .sort((a, b) => 
        {
            if (a.rating > b.rating) {
                return -1
            }
            else if (a.rating < b.rating) {
                return 1;
            }
            else {
                return 0;
            }
        }).slice(0, 200);
        var ids = [];
        results.forEach((result) => {
            ids.push(result.id);
        });
        queryString = `
        query($anime: [Int], $length: Int, $page: Int) {
            Page(page: $page, perPage: $length) {
              pageInfo {
                hasNextPage
              }
              media(id_in: $anime) {
                id
                title {
                  romaji
                  english
                }
                format
                coverImage {
                    extraLarge
                }
                siteUrl
                seasonYear
                episodes
                description(asHtml: true)
                externalLinks {
                    type
                    url
                    icon
                    color
                }
              }
            }
          }
        `
        variables = {
            length : results.length,
            anime: ids,
            page: 1
        }
        options.body = JSON.stringify({
            query: queryString,
            variables: variables
        })
        var data = null, 
        finalObject = [];
        do {
            data = await (fetch(url,options).then(handleResponse)).catch(handleError);
            data.data.Page.media.forEach((show) => {
                recData = results.find((result) => result.id === show.id);
                show.rating = recData.rating;
                show.sources = recData.sources;
                show.externalLinks = show.externalLinks.filter((link) => link.type === "STREAMING");
                finalObject.push(show);
            })
            variables.page += 1;
            options.body = JSON.stringify({
                query: queryString,
                variables: variables
            })
        } while(data.data.Page.pageInfo.hasNextPage)
        finalObject.sort((a, b) => 
                {
                    if (a.rating > b.rating) {
                        return -1
                    }
                    else if (a.rating < b.rating) {
                        return 1;
                    }
                    else {
                        return 0;
                    }
                })
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.write(JSON.stringify(finalObject));
        res.end();
    }
}

/*Calculate rating by getting how many upvotes out of total given to the reccs it has, 
then mutliply by the score adjusted so 1-4 becomes negative, 5 is neutral, 6-10 is positive (score 10 example, we pass in format half so it works for all)
Then multiply by certanty, which reads how many digits of total upvotes we have. 2 digits is the base, 3 digits is a two times multipler, and 4 digits is a three times*/
function calculateRating(score, upvotes, totalUpvotes, formatHalf) {
    var percentage = upvotes / totalUpvotes;
    var relativeScore = score - formatHalf;
    var certantityAdjustment = totalUpvotes.toString().length - 1;
    return relativeScore * percentage * certantityAdjustment;
}

http.createServer(onRequest).listen(port);

console.log ("Listening on Localhost:" + port)
