const http = require('http');
const url = require('url');
const fs = require('fs');
const port = 3000;

var index = fs.readFileSync(__dirname + "/../index.html");
var scriptFile = fs.readFileSync(__dirname + "/../client/client.js");
var cssFile = fs.readFileSync(__dirname + "/../main.css");

function onRequest(req, res) {
    var pathObj = url.parse(req.url, true);
    var params = pathObj.query;

    if (pathObj.pathname === "/") {
        res.writeHead(200, {"Content-Type" : "text/html"});
        res.write(index);
        res.end();
    }

    if(pathObj.pathname === "/userSearch") {
        res = userSearch(req, res, params.term);
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
                lists {
                    status
                    entries {
                      score
                      media {
                        id
                        recommendations {
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
        id: params
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
        res.writeHead(500, {'Content-Type': 'application/json'});
        var responseMessage = {
            message: "Failed to connect to anilist. Check Username info and try again"
        };

        res.write(JSON.stringify(responseMessage));
        res.end();
    }

    function handleResponse(response) {
        return response.json().then(function (json) {
            return response.ok ? json : Promise.reject();
        });
    }
    
    function handleData(data) {
        var entries = data.data.MediaListCollection.lists.filter((list) => list.status === "COMPLETED")[0].entries
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
            //If the total number of upvotes is less than or equal to the number of recs that we should probably just ignore them
            if (totalUpvotes <= recommendations.length) {
                continue;
            }
            //Now iterate through the recs for real
            for (var j = 0; j < recommendations.length; j++) {
                //If it has a sub zero rating it sucks, also sometimes it just has a recommendation of null? ignore them
                if (recommendations[j].node.rating <= 0 || recommendations[j].node.mediaRecommendation === null) {
                    continue;
                }
                var existingRec = null;
                //If the rec array already has stuff and it already exists we should add to it
                if(recs.length > 0) {
                    existingRec = recs.find((e) => e.id === recommendations[j].node.mediaRecommendation.id);
                    if (existingRec != null) {
                        existingRec.rating += calculateRating(score, recommendations[j].node.rating, totalUpvotes);
                    }
                }
                //If there is no recs or it hasn't been added yet, add it
                if (existingRec == null || recs.length === 0) {
                    recs.push({
                        id: recommendations[j].node.mediaRecommendation.id,
                        rating: calculateRating(score, recommendations[j].node.rating, totalUpvotes)
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
        query($anime: [Int], $length: Int) {
            Page(page: 1, perPage: $length) {
              pageInfo {
                total
                currentPage
                lastPage
              }
              media(id_in: $anime) {
                id
                title {
                  romaji
                  english
                }
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
            anime: ids
        }
        options.body = JSON.stringify({
            query: queryString,
            variables: variables
        })
        fetch(url, options).then(handleResponse)
            .then(function(data) {
                var finalObject = [];
                //Take the data we get back an add on the rating info
                data.data.Page.media.forEach((show) => {
                    show.rating = results.find((result) => result.id === show.id).rating;
                    show.externalLinks = show.externalLinks.filter((link) => link.type === "STREAMING");
                    finalObject.push(show);
                })
                //Sort out the Object by rating
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
            })
            .catch(handleError)
    }
}

//Calculate rating by getting how many upvotes out of total given to the reccs it has, then mutliply by the score adjusted so 1-4 becomes negative, 5 is neutral, 6-10 is positive
function calculateRating(score, upvotes, totalUpvotes) {
    var percentage = upvotes / totalUpvotes;
    var relativeScore = score - 5;
    return relativeScore * percentage;
}

http.createServer(onRequest).listen(port);

console.log ("Listening on Localhost:" + port)
