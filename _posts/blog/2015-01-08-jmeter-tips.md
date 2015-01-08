---
layout: post
title: jmeter tips
description: jmeter 测试使用较多和比较常用的技巧
category: blog
tags: [jmeter, test]
---
[上一篇文章]()中介绍了 jmeter 和 badboy 搭配使用。现在我们介绍下 jmeter 的一些隐性好用的方面。

## jmeter plugins
我们使用 jmeter 做性能测试时，会发现有时候 jmeter 的原生支持有时候也不是很好用，比如 jmeter 的图表报告就比较难看，这个时候我们可以使用  [jmeter-plugins](http://jmeter-plugins.org/)。我么可以去官方网站上下载，它包括下面几个类型的插件

- [Standard Set](http://jmeter-plugins.org/wiki/StandardSet/)
- [Extras Set](http://jmeter-plugins.org/wiki/ExtrasSet/)
- [Extras with Libs Set](http://jmeter-plugins.org/wiki/ExtrasWithLibsSet/)
- [WebDriver Set](http://jmeter-plugins.org/wiki/WebDriverSet/)
- [Hadoop Set](http://jmeter-plugins.org/wiki/HadoopSet/)

从 Extras Set 就包含了各种图表报告，在 Extras with Libs Set 中有 json 和 OAuth 协议的支持。

### 安装
我们只需要将下载的 plugins 解压到

<pre>apache-jmeter-2.11\lib\ext</pre>

即可。

## jmeter 测试非 http 协议

## jmeter 参数化


[-10]:    http://hushi55.github.io/  "-10"
