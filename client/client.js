var app,
    recs,
    animeCards = { props: ['rec'], methods: {
        getImageUrl: function(image) {
            return 'background-image: url("' + image + '")';
        }
    },
    template: `
        <div class="col">
            <div class="card h-100">
                <div class="background-image" :style="getImageUrl(rec.coverImage.extraLarge)">
                </div>
                <div class="card-body">
                    <h4 class="card-title">{{rec.title.english}} <span class="badge text-bg-info">{{rec.seasonYear}}</span></h4>
                    <div class="card-text" v-html="rec.description"></div>
                    <p>{{rec.episodes}} Episodes</p>
                </div>
                <div class="card-footer">
                    <div class="overflow-x-auto site-link-container">
                        <div v-for="(link,index) in rec.externalLinks" v-bind:class="{'last-link': index === rec.externalLinks.length -1, 'card-iconlink': true }">
                            <a :href="(link.url)">
                                <img class="site-icon" :src="(link.icon)" v-bind:style="{backgroundColor: link.color}"> </img>
                            </a>
                        </div>
                    </div>
                    <a class="card-hotlink" :href="(rec.siteUrl)" target="_blank">
                        <img class="site-icon" src="https://anilist.co/img/icons/icon.svg"></img>
                    </a> 
                </div>
            </div>
        </div>
    `
    }

$(document).ready(function(){
    app = new Vue({
        el:'#mainApp',
        components: {
            'anime-rec': animeCards
        },
        data: {
            recs: ''
        }
    });

    $("#searchForm").submit(function(e) {
        var submitButton = $("#submitButton");
        var usernameSearch = $("#usernameSearch");
        var action = $("#searchForm").attr("action");
        var formData = $("#searchForm").serializeArray();
        submitButton.prop("disabled", true);
        usernameSearch.prop("disabled", true);
        document.querySelector("#apiCall").style.display = "block";

        var dataObj = {};
        formData.forEach((data) => {
            dataObj = {[data.name] : data.value }
        })
        
        $.ajax({
            cache: false,
            type: 'get',
            url: action,
            data: formData,
            dataType: "JSON",
            success: function(result, status, xhr) {
                app.recs = result;
                document.querySelector("#result").style.display = "flex";
                document.querySelector("#apiCall").style.display = "none";
                submitButton.prop("disabled", null);
                usernameSearch.prop("disabled", null);
                $(document).ready(function(e) {
                    Array.from(document.getElementsByClassName("site-link-container")).forEach((siteCon) => {
                        if (siteCon.scrollWidth <= siteCon.clientWidth) {
                            siteCon.classList.add("non-scroll-container");
                        }
                    })
                })
            },
            error: function(error, status, xhr) {
                var resultText = JSON.stringify(error);
                $("#result").text(resultText);
                submitButton.prop("disabled", null);
                usernameSearch.prop("disabled", null);
            }
        });

        e.preventDefault();
        return false;
    });
});