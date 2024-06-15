var app,
    recs,
    animeCards = { props: ['rec'], methods: {
        getImageUrl: function(image) {
            return 'background-image: url("' + image + '")';
        }
    },
    template: `
        <div>
            <div class="background-image" :style="getImageUrl(rec.coverImage.extraLarge)">
            </div>
            <h5>{{rec.title.english}}</h5>
            <a :href="(rec.siteUrl)" target="_blank">Go To Page</a> 
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
        var action = $("#searchForm").attr("action");
        var term = $("#usernameSearch").val();

        $.ajax({
            cache: false,
            type: 'get',
            url: action,
            data: "term=" + term,
            dataType: "JSON",
            success: function(result, status, xhr) {
                app.recs = result;
                document.querySelector("#result").style.display = "block";
            },
            error: function(error, status, xhr) {
                var resultText = JSON.stringify(error);
                $("#result").text(resultText);
            }
        });

        e.preventDefault();
        return false;
    });
});