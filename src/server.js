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
}, scoreFormat = [
    {name: "POINT_100", half: 50},
    {name: "POINT_10_DECIMAL", half: 5},
    {name: "POINT_10", half: 5},
    {name: "POINT_5", half: 3 },
    {name: "POINT_3", half: 2 }
], mediaRelation = {
    adapt: "ADAPTION",
    char: "CHARACTER",
    org: "ORIGINAL"
}

var location = `https://graphql.anilist.co`,
options ={
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    body: {}
};


function handleResponse(response) {
    console.log(response);
    return response.json().then(function (json) {
        return response.ok ? json : Promise.reject({status: response.status, statusText: response.statusText});
    });
}


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
    if (pathObj.pathname === '/franchiseSearch'){
        res = franchiseSearch(req, res, params);
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

function formatEntry(preFormatted, relationType) {
    var formmated = {}
    formmated.romaji = preFormatted.title.romaji;
    formmated.english = preFormatted.title.english;
    if(preFormatted.startDate.year == null) {
        preFormatted.startDate.year = 2050;
    }
    formmated.startDate = new Date(preFormatted.startDate.year, preFormatted.startDate.month, preFormatted.startDate.day);
    formmated.id = preFormatted.id;
    formmated.episodes = preFormatted.episodes;
    formmated.relationType = preFormatted.relationType;
    formmated.relationType = relationType;
    formmated.siteUrl = preFormatted.siteUrl;
    return formmated;
} 

function addUserInfo(formatted, score, status, progress) {
    formatted.score = score;
    formatted.status = status;
    formatted.progress = progress;
    return formatted;
}

function pruneDuplicates(newList, originalList, original ) {
    var newToAdd = [];
    //loop through all of the new relations
    newList.forEach((relation) => {
        //If we look through the original list of relations and don't find it, its new so add it the array. We also don't want to add the oringal itself
        if (!originalList.find((existingRelations) => existingRelations.id == relation.id) && original.id != relation.id){
            newToAdd.push(relation);
        }
    });
    return newToAdd;
}


async function franchiseSearch(req, res, params) {
    function handleError(error) {
        console.log(error);
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.write(JSON.stringify(error));
        res.end();
    }

    var queryString = `
        query($id: String) {
                MediaListCollection(userName: $id, type: ANIME, sort: MEDIA_ID) {
                  lists {
                    status
                    entries {
                      status
                      progress
                      score
                      media {
                        id
                        title {
                          romaji
                          english
                        }
                        siteUrl
                        startDate {
                            year
                            month
                            day
                        }
                        episodes
                        relations {
                          edges {
                            relationType
                            node {
                              id
                              type
                              startDate {
                                year
                                month
                                day
                              }
                              siteUrl
                              title {
                                romaji
                                english
                              }
                              episodes
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
    `,
    variables = {
        id: params.term
    }, data = {};

    options.body = JSON.stringify({
        query: queryString,
        variables: variables
    });
    data = await ((fetch(location,options).then(handleResponse)).catch(handleError));

    var finalObjects = [],
        allEntries = [];

    data.data.MediaListCollection.lists.forEach((list) => {
        allEntries.push(...list.entries);
    })

    allEntries.forEach((entry) => {
        var relations = entry.media.relations.edges,
            finalObject = {original: addUserInfo(formatEntry(entry.media, mediaRelation.org), entry.score, entry.status, entry. progress), following: []};
        relations.forEach((relation) => {
            if (relation.relationType == mediaRelation.adapt || relation.node.type == "MANGA" || relation.relationType == mediaRelation.char) {
                return;
            }
            finalObject.following.push(formatEntry(relation.node, relation.relationType));
        })

        //atempt to search through all existing entries, specifically their relations to see if we found one
        var existingEntry = finalObjects.find((entrytwo) => {
            return entrytwo.following.find((relation) => {
                if(finalObject.original.id == relation.id) {
                    foundRelation = relation;
                    return true;
                }
                return  false
            })
        });
        if (existingEntry == null) {
            existingEntry = finalObjects.find((entryTwo) => {
                return entryTwo.following.find((relation) => {
                    return finalObject.following.find((relationTwo) => {
                        return relation.id == relationTwo.id;
                    })
                });
            })
        }        
        if (existingEntry) {
            //Existing entry = original show + its relations
            //final object = current show + its interations
            //If it's a newer work we still want to add it to the list of relations
            var existingRelation = existingEntry.following.find((relation) => relation.id == finalObject.original.id)
            //If it already was a relation we just want to add on new info like score and status
            if (existingRelation) {
                addUserInfo(existingRelation, finalObject.original.score, finalObject.original.status, finalObject.original.progress);
            }
            //If not we just want to add it
            else {
                existingEntry.following.push(finalObject.original);
            }
            //We want to add on relations of the new entry, but only the new ones
            existingEntry.following.push(...pruneDuplicates(finalObject.following, existingEntry.following, existingEntry.original));
        }
        else {
            //If its not found already we want to add it to thel ist
            finalObjects.push(finalObject);
        }        
    });

    var filteredDownFranchises = finalObjects.filter((obj) => {
        //Keep the length reasonable (TODO make this modifiable by the user)
        return obj.following.length > 5
    }).filter((obj) => {
        //We only want to show franchises where at least one of the shows has been watched
        return obj.original.status == mediaStatus.com || obj.original.status == mediaStatus.repeat || obj.following.find((follow) => follow.status == mediaStatus.com || follow.status == mediaStatus.repeat)
    }).map((obj) => {
        //Organize by date
        obj.following.sort((a, b) => 
        {
            if (a.startDate < b.startDate) {
                return -1
            }
            else if (a.startDate > b.startDate) {
                return 1;
            }
            else {
                return 0;
            }
        });

        obj.following.forEach((follow) => {
            //If we did and its older than the original, it should be the start of the chain
            if (obj.original.startDate > follow.startDate) {
                
                //Add original show as a relation to new show
                obj.following.push(obj.original);
                obj.original = follow;
                //remove new show from array of relations
                obj.following.splice(obj.following.findIndex((originalLink) => {
                    return originalLink.id == follow.id;
                }), 1);
            } 
        });
        return obj;
    });

    filteredDownFranchises.forEach((franchise) => {
        var reducedArray = filteredDownFranchises.filter((otherFranchise, index) => { 
            if (otherFranchise.original.id == franchise.original.id) {
                otherFranchise.index = index;
                return true;
            }
            return false;
        });
        if(reducedArray.length > 1) {
            for (var i = 1; i < reducedArray.length; i++) {
                reducedArray[0].following.push(...pruneDuplicates(reducedArray[i].following, reducedArray[0].following, reducedArray[0].original));
                filteredDownFranchises.splice(reducedArray[i].index, 1);
            }
        }
        if(!franchise.original.status) {
            var entry = allEntries.find((entry) => entry.media.id == franchise.original.id);
            if (entry) {
                addUserInfo(franchise.original, entry.score, entry.status, entry.progress);
            }
        } 
        franchise.following.forEach((related) => {
            if(!related.status) {
                var relatedEntry = allEntries.find((entry) => entry.media.id == related.id);
                if (relatedEntry) {
                    addUserInfo(related, relatedEntry.score, relatedEntry.status, relatedEntry.progress);
                }
            }
        })
    })

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(filteredDownFranchises));
    res.end();
    
    return res;
}

function userSearch(req, res, params) {
    function handleError(error) {
        console.log(error);
        res.writeHead(500, {'Content-Type': 'application/json'});
    
        res.write(JSON.stringify(error));
        res.end();
    }

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

    options.body = JSON.stringify({
                query: queryString,
                variables: variables
            });
    fetch(location, options).then(handleResponse)
                       .then(handleData)
                       .catch(handleError)
    return res;

    async function handleData(data) {
        //get the lists of the users anime which are split into categories
        var userLists = data.data.MediaListCollection.lists;
        //For calculation sake we need to find what type of score this user has
        var formatHalf = scoreFormat.find((format) => format.name === data.data.MediaListCollection.user.mediaListOptions.scoreFormat).half;
        //Start with statuses we want to include, we always want to include completed and rewatching
        var statusToAllow = [mediaStatus.com, mediaStatus.repeat];
        var exponentMode = params.exponent;
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
        entries.forEach((entry) => {
            var score = entry.score;
            //if the score is zero assume it isn't rated, also if its a half score we ignore it
            if (score === 0 || score === formatHalf) {
                return;
            }
            var totalUpvotes = 0;
            //Grab the array of recommendations
            var recommendations = entry.media.recommendations.edges;
            //Iterate through the recommendations
           recommendations.forEach((reccomendation) => {
                //If the rec has a 0 or sub zero rating ignore it also sometimes it just has a recommendation of null?
                if (reccomendation.node.rating <= 0 || reccomendation.node.mediaRecommendation === null) {
                    return;
                }
                //Add up all the recs to get some math
                totalUpvotes += reccomendation.node.rating;
            });
            //If the total number of upvotes is less than or equal to the number of recs that we should probably just ignore them. Same if there are less than 10 total upvotes, it breaks the math
            if (totalUpvotes <= recommendations.length || totalUpvotes < 10) {
                return;
            }
            //Now iterate through the recs for real
            recommendations.forEach((reccomendation) => {
                //ignore this if the rating is les than zero, or if the recommendation is null
                if (reccomendation.node.rating <= 0 ||  reccomendation.node.mediaRecommendation === null) {
                    return;
                }
                var existingRec = recs.find((e) => e.id === reccomendation.node.mediaRecommendation.id);
                if (existingRec != null) {
                    var sequelDeweight = 1;
                    existingRec.sources.map((source) => {
                        //If we find this show has the title of another show in it, its a direct sequel and we want to deweight it
                        if (entry.media.title.romaji.indexOf(source.romajiName) >= 0) {
                            source.sequels += 2;
                            //we deweight starting at 1 seuqel going up
                            sequelDeweight = source.sequels + 1;
                        }
                        return source;
                    })
                    var ratingCalc = calculateRating(score, reccomendation.node.rating, totalUpvotes, formatHalf, sequelDeweight, exponentMode);
                    existingRec.rating += ratingCalc
                    existingRec.sources.push({englishName: entry.media.title.english, romajiName: entry.media.title.romaji, upvotes: reccomendation.node.rating, totalUpvotes: totalUpvotes, score: score, sequels: 0, rating: ratingCalc})
                }
                //If there is no recs or it hasn't been added yet, add it
                else {
                    var ratingCalc = calculateRating(score, reccomendation.node.rating, totalUpvotes, formatHalf, 1, exponentMode);
                    recs.push({
                        id: reccomendation.node.mediaRecommendation.id,
                        rating: ratingCalc,
                        sources: [{englishName: entry.media.title.english, romajiName: entry.media.title.romaji, upvotes: reccomendation.node.rating, totalUpvotes: totalUpvotes, score: score, sequels: 0, rating: ratingCalc}]
                    })
                }
            });
         });
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
        //Loop while we still have pages of data to retrieve
        do {
            data = await (fetch(location,options).then(handleResponse)).catch(handleError);
            data.data.Page.media.forEach((show) => {
                recData = results.find((result) => result.id === show.id);
                //avoids over recomending shows with only 1 or 2 sources. if there are at least 3 sources multiplies by 1, otherwise multiply by 1/2 or 1/3
                var adjustedRating = recData.rating *(1/(recData.sources.length < 3 ? recData.sources.length % 3 : 1));
                //If the rating value was so small that it increased ignore that calc, otherwise just return the adjusted rating
                show.rating = adjustedRating <= recData.rating ? adjustedRating : recData.rating;
                show.sources = recData.sources.sort((a, b) => {
                    if (a.rating > b.rating) {
                        return -1;
                    }
                    else if (a.rating < b.rating) {
                        return 1;
                    }
                    else {
                        return 0;
                    }
                });
                show.externalLinks = show.externalLinks.filter((link) => link.type === "STREAMING");
                finalObject.push(show);
            })
            //reset variables so we can query the next page
            variables.page += 1;
            options.body = JSON.stringify({
                query: queryString,
                variables: variables
            })
        } while(data.data.Page.pageInfo.hasNextPage)
        //Sort the data since it comes back in random order
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
Then multiply by certanty, which reads how many digits of total upvotes we have. 2 digits is the base, 3 digits is a two times multipler, and 4 digits is a three times
divide by the number of sequels, the more the lower the impact the number is. If there are no sequels it is 1*/
function calculateRating(score, upvotes, totalUpvotes, formatHalf, sequelDeweight, doExponent) {
    var percentage = (upvotes / totalUpvotes) * 100;
    var relativeScore = score - formatHalf;
    var certantityAdjustment = totalUpvotes.toString().length - 1;
    if (doExponent) {
        var modifier = relativeScore > 0 ? 1 : -1
        return (modifier * (percentage**(Math.abs(relativeScore))) * certantityAdjustment) / sequelDeweight;
    }
    else {
        return (relativeScore * percentage * certantityAdjustment) / sequelDeweight;
    }
}

http.createServer(onRequest).listen(port);

console.log ("Listening on Localhost:" + port)
