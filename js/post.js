$(document).ready(function(){

    var isMobile = {
        Android: function() {
            return navigator.userAgent.match(/Android/i);
        }
        ,BlackBerry: function() {
            return navigator.userAgent.match(/BlackBerry/i);
        }
        ,iOS: function() {
            return navigator.userAgent.match(/iPhone|iPad|iPod/i);
        }
        ,Opera: function() {
            return navigator.userAgent.match(/Opera Mini/i);
        }
        ,Windows: function() {
            return navigator.userAgent.match(/IEMobile/i);
        }
        ,any: function() {
            return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
        }
    };

    $('pre').addClass('prettyprint linenums'); //添加Google code Hight需要的class

    $('.entry a').each(function(index,element){
        var href = $(this).attr('href');
        if(href){
            if(href.indexOf('#') == 0){
            }else if ( href.indexOf('/') == 0 || href.toLowerCase().indexOf('beiyuu.com')>-1 ){
            }else if ($(element).has('img').length){
            }else{
                $(this).attr('target','_blank');
                $(this).addClass('external');
            }
        }
    });

    (function(){
        var ie6 = ($.browser.msie && $.browser.version=="6.0") ? true : false;

        function initHeading(){
            var h2 = [];
            var h3 = [];
            var h2index = 0;

            $.each($('.entry h2, .entry h3'),function(index,item){
                if(item.tagName.toLowerCase() == 'h2'){
                    var h2item = {};
                    h2item.name = $(item).text();
                    h2item.id = 'menuIndex'+index;
                    h2.push(h2item);
                    h2index++;
                }else{
                    var h3item = {};
                    h3item.name = $(item).text();
                    h3item.id = 'menuIndex'+index;
                    if(!h3[h2index-1]){
                        h3[h2index-1] = [];
                    }
                    h3[h2index-1].push(h3item);
                }
                item.id = 'menuIndex' + index;
            });

            return {h2:h2,h3:h3}
        }

        function genTmpl(){
            var h1txt = $('h1').text();
            var tmpl = '<ul><li class="h1"><a href="#">' + h1txt + '</a></li>';

            var heading = initHeading();
            var h2 = heading.h2;
            var h3 = heading.h3;

            for(var i=0;i<h2.length;i++){
                tmpl += '<li><a href="#" data-id="'+h2[i].id+'">'+h2[i].name+'</a></li>';

                if(h3[i]){
                    for(var j=0;j<h3[i].length;j++){
                        tmpl += '<li class="h3"><a href="#" data-id="'+h3[i][j].id+'">'+h3[i][j].name+'</a></li>';
                    }
                }
            }
            tmpl += '</ul>';

            return tmpl;
        }

        function genIndex(){
            var tmpl = genTmpl();
            var indexCon = '<div id="menuIndex" class="sidenav"></div>';

            $('#content').append(indexCon);

            $('#menuIndex')
                .append($(tmpl))
                .delegate('a','click',function(e){
                    e.preventDefault();

                    var selector = $(this).attr('data-id') ? '#'+$(this).attr('data-id') : 'h1'
                    var scrollNum = $(selector).offset().top;

                    $('body, html').animate({ scrollTop: scrollNum-30 }, 400, 'swing');
                });
        }

        var waitForFinalEvent = (function () {
            var timers = {};
            return function (callback, ms, uniqueId) {
                if (!uniqueId) {
                    uniqueId = "Don't call this twice without a uniqueId";
                }
                if (timers[uniqueId]) {
                    clearTimeout (timers[uniqueId]);
                }
                timers[uniqueId] = setTimeout(callback, ms);
            };
        })();

        if($('.entry h2').length > 2 && !isMobile.any() && !ie6){

            genIndex();

            $(window).load(function(){
                var scrollTop = [];
                $.each($('#menuIndex li a'),function(index,item){
                    var selector = $(item).attr('data-id') ? '#'+$(item).attr('data-id') : 'h1'
                    var top = $(selector).offset().top;
                    scrollTop.push(top);
                });

                var menuIndexTop = $('#menuIndex').offset().top;
                var menuIndexLeft = $('#menuIndex').offset().left;

                $(window).scroll(function(){
                    waitForFinalEvent(function(){
                        var nowTop = $(window).scrollTop();
                        var length = scrollTop.length;
                        var index;

                        if(nowTop+20 > menuIndexTop){
                            $('#menuIndex').css({
                                position:'fixed'
                                ,top:'20px'
                                ,left:menuIndexLeft
                            });
                        }else{
                            $('#menuIndex').css({
                                position:'static'
                                ,top:0
                                ,left:0
                            });
                        }

                        if(nowTop+60 > scrollTop[length-1]){
                            index = length;
                        }else{
                            for(var i=0;i<length;i++){
                                if(nowTop+60 <= scrollTop[i]){
                                    index = i;
                                    break;
                                }
                            }
                        }
                        $('#menuIndex li').removeClass('on');
                        $('#menuIndex li').eq(index-1).addClass('on');
                    });
                });

                $(window).resize(function(){
                    $('#menuIndex').css({
                        position:'static'
                        ,top:0
                        ,left:0
                    });

                    menuIndexTop = $('#menuIndex').offset().top;
                    menuIndexLeft = $('#menuIndex').offset().left;

                    $(window).trigger('scroll')
                    $('#menuIndex').css('max-height',$(window).height()-80);
                });
            })

            //用js计算屏幕的高度
            $('#menuIndex').css('max-height',$(window).height()-80);
        }
    })();

    $.getScript('/js/prettify/prettify.js',function(){
        prettyPrint();
    });

    if(/\#comment/.test(location.hash)){
        $('#disqus_container .comment').trigger('click');
    }

    if(/css3-animation/.test(location.href)){
        $("head").append("<link rel='stylesheet' type='text/css' href='/css/css3-ani.css'/>");
        $.getScript('/js/css3-ani.js',function(){});
    }

   //<!-- 多说评论框 start -->
	// (function() {
   //
	// 	var ds_div = '<div class="ds-thread entry" style="clear:none" data-thread-key="' + data_thread_key + '" ' +
	// 		' data-title="' + data_title + '"' +
	// 		' data-url="' + data_url +'"></div>';
	// 	$('#content').append(ds_div);
   //
	// 	var ds = document.createElement('script');
	// 	ds.type = 'text/javascript';ds.async = true;
	// 	ds.src = (document.location.protocol == 'https:' ? 'https:' : 'http:') + '//static.duoshuo.com/embed.js';
	// 	ds.charset = 'UTF-8';
	// 	(document.getElementsByTagName('head')[0]
	// 	 || document.getElementsByTagName('body')[0]).appendChild(ds);
	// })();
	//<!-- 多说评论框 end -->

    <!-- 来必力City版安装代码 -->
    // (function(d, s) {
    //
    //     var ds_div = '<div id="lv-container" data-id="city" data-uid="MTAyMC8zMTMzOC83ODg3" class="entry" style="clear:none"><noscript> 为正常使用来必力评论功能请激活JavaScript</noscript></div>';
    //     $('#content').append(ds_div);
    //
    //
    //
    //     var j, e = d.getElementsByTagName(s)[0];
    //
    //     if (typeof LivereTower === 'function') { return; }
    //
    //     j = d.createElement(s);
    //     j.src = 'https://cdn-city.livere.com/js/embed.dist.js';
    //     j.async = true;
    //
    //     e.parentNode.insertBefore(j, e);
    // })(document, 'script');
    <!-- City版安装代码已完成 -->
    (function(d, s) {

        var j, e = d.getElementsByTagName(s)[0];
        if (typeof LivereTower === 'function') { return; }

        {
            j = d.createElement('link');
            j.href = 'https://unpkg.com/gitalk/dist/gitalk.css';
            j.type = 'text/css';
            j.rel = 'stylesheet';
            e.parentNode.insertBefore(j, e);
        }

        {
            j = d.createElement(s);
            j.src = 'https://unpkg.com/gitalk/dist/gitalk.min.js';
            j.async = true;
            e.parentNode.insertBefore(j, e);
        }

        var ds_div = '<div id="gitalk-container" class="gitalkentry"></div>';
        $('#content').append(ds_div);
        const gitalk = new Gitalk({
            clientID: '2fe553c1b8790a2ba353',
            clientSecret: '3515b38966784278b11cc785fe9240367e9264ba',
            repo: 'hushi55.github.io',      // The repository of store comments,
            owner: 'hushi55',
            admin: ['hushi55'],
            id: location.pathname,      // Ensure uniqueness and length less than 50
            distractionFreeMode: false  // Facebook-like distraction free mode
        })
        gitalk.render('gitalk-container')

    })(document, 'script');


});


