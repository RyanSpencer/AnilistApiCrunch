var app,
    cardcolumns = 'row-cols-5',
    animeCards = { props: ['rec', 'titleLanguage'], 
    methods: {
        getImageUrl: function(image) {
            return 'background-image: url("' + image + '")';
        },
        description: function(e, id) {
            e.preventDefault();
            rec = app.recs.find( rec => {
                return rec.id === id;
            });
            rec.displayDesc = !rec.displayDesc;
        }
    },
    template: `
        <div class="col">
            <div class="card h-100">
                <button type="button" class="btn btn-info btn-description-data" v-on:click="description($event, rec.id)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
                    </svg>
                </button>
                <button type="button" class="btn btn-secondary btn-rec-data" data-bs-toggle="modal" data-bs-target="#recDataModal" v-bind:data-anime-id="rec.id">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-gear-fill" viewBox="0 0 16 16">
                        <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                    </svg>
                </button>
                <div class="background-image" :style="getImageUrl(rec.coverImage.extraLarge)">
                    <div class="card-text" v-html="rec.description" v-if="rec.displayDesc"></div>
                </div>
                <div class="card-body">
                    <h4 class="card-title" v-if="(titleLanguage === 'english' && rec.title.english != null ) || rec.title.romaji == null">{{rec.title.english}} <span class="badge text-bg-info">{{rec.seasonYear}}</span></h4>
                    <h4 class="card-title" v-if="(titleLanguage === 'romaji' && rec.title.romaji != null ) || rec.title.english == null">{{rec.title.romaji}} <span class="badge text-bg-info">{{rec.seasonYear}}</span></h4>
                    <p v-show="rec.episodes != null && rec.format != 'MOVIE'">{{rec.episodes}} Episode{{rec.episodes > 1 ? 's' : ''}} </p>
                    <p v-show="rec.format == 'MOVIE'">Movie</p>
                </div>
                <div class="card-footer">
                    <div class="overflow-x-auto site-link-container" v-bind:class="{'empty-links': rec.externalLinks.length < 1}">
                        <div v-for="(link,index) in rec.externalLinks" v-bind:class="[{'last-link': index === rec.externalLinks.length -1}, 'card-iconlink']">
                            <a :href="(link.url)"  target="_blank">
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
    },
    anilistQueryForm = { props: ['formData', 'loads'],
        methods: {
          submitApiCall: function(e) {
            var action = $('#' + e.target.id).attr("action");
            var formData = $('#' + e.target.id).serializeArray();
    
            var dataObj = {};
            formData.forEach((data) => {
                dataObj[data.name] = data.value
            })
            app.errorText = null;
            app.loading = true;
            $.ajax({
                cache: false,
                type: 'get',
                url: action,
                data: dataObj,
                dataType: "JSON",
                success: function(result, status, xhr) {
                    if (action == app.recommedationsForm.action) {
                        result.map((rec) => {
                            rec.show = true;
                            rec.displayDesc = false;
                            preloadImage(rec.coverImage.extraLarge);
                        })
                        app.recs = result.slice(0, 25);
                        app.fullRec = result;
                        $(document).ready(function(e) {
                            Array.from(document.getElementsByClassName("site-link-container")).forEach((siteCon) => {
                                if (siteCon.scrollWidth <= siteCon.clientWidth) {
                                    siteCon.classList.add("non-scroll-container");
                                }
                            })
                        });
                    }
                    else if (action == app.franchiseForm.action) {
                        app.franchises = result;
                    }
                    app.loading = false
                },
                error: function(error, status, xhr) {
                    app.loading = false;
                    app.errorText = error;
                    app.errorText.error = JSON.parse(error.responseText);
                }
            });
    
            e.preventDefault();
            return false;
          }  
        },
        template: `
            <form class="search-form" :id="formData.id" :action="formData.action" :method="formData.get" v-on:submit="submitApiCall($event)">
                <input class="form-control" id="usernameSearch" type="text" name="term" placeholder="Your AniList Username">
                <input class="btn btn-primary" id="submitButton" type="submit" :value="formData.value" :disabled="loads">
                <slot></slot>
            </form>
        `
    },
    franchiseView = { props: ['franchiseObject', "titleLanguage"],
        template: `
            <div class="list-group">
                <a :href="franchiseObject.original.siteUrl" target="_blank" 
                    class="list-group-item list-group-item-action active"> 
                    <p style="margin-left: 10px" class="franchise-name">{{((titleLanguage === 'english' && franchiseObject.original.english != null ) ||franchiseObject.original.romaji == null) ? franchiseObject.original.english : franchiseObject.original.romaji}}
                        <span v-if="franchiseObject.original.status" class="badge" v-bind:class="{'text-bg-success': franchiseObject.original.status == 'COMPLETED', 'text-bg-primary': franchiseObject.original.status == 'CURRENT', 'text-bg-danger': franchiseObject.original.status == 'DROPPED', 'text-bg-warning' : franchiseObject.original.status == 'PAUSED', 'text-bg-info': franchiseObject.original.status == 'PLANNING', 'text-bg-secondary': franchiseObject.original.status == 'REPEATING'}">{{franchiseObject.original.status}}</span>
                    </p>
                    <div class="score-length"> 
                        <span v-if="franchiseObject.original.score" class="badge text-bg-dark">{{franchiseObject.original.score}}</span>
                        <p>{{franchiseObject.original.progress ? franchiseObject.original.progress + " / " : "" }} {{franchiseObject.original.episodes}}</p>
                    </div>
                </a>
                <a v-for="follow in franchiseObject.following" 
                    :href="follow.siteUrl" target="_blank" class="list-group-item list-group-item-action"> 
                    <p style="margin-left: 10px" class="franchise-name">{{((titleLanguage === 'english' && follow.english != null ) ||follow.romaji == null) ? follow.english : follow.romaji}}
                        <span v-if="follow.status" class="badge" v-bind:class="{'text-bg-success': follow.status == 'COMPLETED', 'text-bg-primary': follow.status == 'CURRENT', 'text-bg-danger': follow.status == 'DROPPED', 'text-bg-warning' : follow.status == 'PAUSED', 'text-bg-info': follow.status == 'PLANNING', 'text-bg-secondary': follow.status == 'REPEATING'}">{{follow.status}}</span>
                    </p>
                    <div class="score-length"> 
                        <span v-if="follow.score" class="badge text-bg-dark">{{follow.score}}</span>
                        <p>{{follow.progress ? follow.progress + " / " : "" }} {{follow.episodes}}</p>
                    </div>
                </a>
            </div>
        `
    }

$(document).ready(function(){
    app = new Vue({
        el:'#mainApp',
        components: {
            'anime-rec': animeCards,
            'anilist-form': anilistQueryForm,
            'franchise-view': franchiseView
        },
        mounted() {
            this.handleResize();
            window.addEventListener('resize', this.handleResize);
        },
        destroyed() {
            window.removeEventListener('resize', this.handleResize);
        },
        methods: {
            handleResize() {
                var size1080p = window.matchMedia('(max-width: 1920px)').matches,
                    size1024p = window.matchMedia('(max-width: 1150px)').matches,
                    size775p = window.matchMedia('(max-width: 775px)').matches;
                    this.cardcolumns = size1080p ? (size1024p ? (size775p ? 'row-cols-1' : 'row-cols-2'): 'row-cols-3') : 'row-cols-5';
                    this.mobile = size775p;
            },
            setPage(page) {
                this.section = page;
            }
        },
        data: {
            recs: [],
            fullRec: [],
            franchises: [],
            currentPage: 1,
            titleLanguage: "english",
            loading: false,
            section: 'recomendations-app',
            sources: [],
            errorText: null,
            recommedationsForm: {
                id: 'rec-form',
                action: '/userSearch',
                method: 'get',
                value: 'Search for Recs'
            },
            franchiseForm: {
                id: 'franchise-form',
                action: '/franchiseSearch',
                method: 'get',
                value: 'Get Franchise List'
            },
            rating: "",
            mobile: false,
            cardcolumns: cardcolumns,
            startYear: 1940,
            endYear: new Date().getFullYear() + 1,
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
                value: "SPECIAL",
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
        app.rating = rec.rating.toLocaleString(undefined);
    });
    $('#dataArea :input').on('change', function(){
        app.fullRec.map((rec)=> {
            var format = app.formats.find((format) => format.value === rec.format);
            rec.show = format.active && rec.seasonYear >= app.startYear && rec.seasonYear <= app.endYear;
            return rec;
        });
        refreshPage();
    });
    $('.page-link').on('click', function(e) {
        e.preventDefault();
        app.currentPage = e.currentTarget.dataset.page;
        refreshPage();
    })

    function refreshPage() {
        var shownRecs = app.fullRec.filter((rec) => rec.show),
            pages = Math.ceil(shownRecs.length / 25);
        if (app.currentPage > pages && pages > 0) {
            app.currentPage = pages;
        }
        app.recs = shownRecs.slice((app.currentPage - 1) * 25 , app.currentPage * 25);
        $(document).ready(function(e) {
            Array.from(document.getElementsByClassName("site-link-container")).forEach((siteCon) => {
                if (siteCon.scrollWidth <= siteCon.clientWidth) {
                    siteCon.classList.add("non-scroll-container");
                }
            })
            for(i = 1; i <= 8; i++) {
                var pageButton = document.getElementById(i + '-page-link'),
                    bottomButton = document.getElementById(i + '-page-link-bottom');
                if (i > pages) {
                    pageButton.classList.add('disabled');
                    bottomButton.classList.add('disabled');
                }
                else {
                    pageButton.classList.remove('disabled');
                    bottomButton.classList.remove('disabled');
                }
            }
        });
    }
});

function preloadImage(url)
{
    var img=new Image();
    img.src=url;
}