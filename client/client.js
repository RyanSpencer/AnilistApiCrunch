var app,
    recs,
    animeCards = { props: ['rec', 'titleLanguage'], methods: {
        getImageUrl: function(image) {
            return 'background-image: url("' + image + '")';
        }
    },
    template: `
        <div class="col">
            <div class="card h-100">
                <button type="button" class="btn btn-secondary btn-rec-data" data-bs-toggle="modal" data-bs-target="#recDataModal" v-bind:data-anime-id="rec.id">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-gear-fill" viewBox="0 0 16 16">
                        <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                    </svg>
                </button>
                <div class="background-image" :style="getImageUrl(rec.coverImage.extraLarge)">
                </div>
                <div class="card-body">
                    <h4 class="card-title" v-if="(titleLanguage === 'english' && rec.title.english != null ) || rec.title.romaji == null">{{rec.title.english}} <span class="badge text-bg-info">{{rec.seasonYear}}</span></h4>
                    <h4 class="card-title" v-if="(titleLanguage === 'romaji' && rec.title.romaji != null ) || rec.title.english == null">{{rec.title.romaji}} <span class="badge text-bg-info">{{rec.seasonYear}}</span></h4>
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
            recs: [],
            titleLanguage: "english",
            loading: false,
            sources: [],
            formats: [
                {name: "Tv",
                value: "TV",
                active: true},
                {name: "Tv Short",
                value: "TV_SHORT",
                active: true},
                {name: "Movie",
                value: "MOVIE",
                active: true},
                {name: "Special",
                value: "Special",
                active: true},
                {name: "OVA",
                value: "OVA",
                active: true},
                {name: "ONA",
                value: "ONA",
                active: true},
                {name: "Music Video",
                value: "MUSIC",
                active: true}
            ]
        }
    });

    $('#recDataModal').on('show.bs.modal', function(event){
        //Grab the button that was clicked so we can determine the project that is being expanded
        var button = $(event.relatedTarget),
            rec = app.recs.find( rec => {
                return rec.id === button.data('animeId');
            });
        app.sources = rec.sources;
    });

    $('input[type="checkbox"], input[type="radio"]').on('change', function () { 
        app.recs.map((rec)=> {
            var format = app.formats.find((format) => format.value === rec.format);
            rec.show = format.active;
            return rec;
        });
    });

    $("#searchForm").submit(function(e) {
        var action = $("#searchForm").attr("action");
        var formData = $("#searchForm").serializeArray();

        var dataObj = {};
        formData.forEach((data) => {
            dataObj[data.name] = data.value
        })
        
        app.loading = true;
        $.ajax({
            cache: false,
            type: 'get',
            url: action,
            data: dataObj,
            dataType: "JSON",
            success: function(result, status, xhr) {
                result.map((rec) => {
                    rec.show = true;
                })
                app.recs = result;
                app.loading = false
                $(document).ready(function(e) {
                    Array.from(document.getElementsByClassName("site-link-container")).forEach((siteCon) => {
                        if (siteCon.scrollWidth <= siteCon.clientWidth) {
                            siteCon.classList.add("non-scroll-container");
                        }
                    })
                })                
            },
            error: function(error, status, xhr) {
                app.loading = false;
                var resultText = JSON.stringify(error);
                $("#result").text(resultText);
            }
        });

        e.preventDefault();
        return false;
    });
});