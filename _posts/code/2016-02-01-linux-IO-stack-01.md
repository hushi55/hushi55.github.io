---
layout: post
title: Linux IO Stack 系列
description: Linux IO 栈系列文章第一篇
category: code
tags: [linux, IO]
---
从这篇文章开始，我试图写一个系列关于 Linux IO Stack 的文章，主要试图讲解清楚我以前似是而非的几个问题：

- zore copy 是什么？
- direct IO 是什么？
- 同步 IO 和异步 IO 的区别是什么？

## 参考

- 一个IO的传奇一生[1],[2],[3],[4],[5],[6],[7],[8],[9],[10]

[-10]:   	 http://hushi55.github.io/  "-10"
[1]:    	 http://alanwu.blog.51cto.com/3652632/1286553   "1"
[2]:    	 http://alanwu.blog.51cto.com/3652632/1286809	"2"
[3]:    	 http://alanwu.blog.51cto.com/3652632/1287592	"3"
[4]:    	 http://alanwu.blog.51cto.com/3652632/1288838	"4"
[5]:    	 http://alanwu.blog.51cto.com/3652632/1294034	"5"
[6]:    	 http://alanwu.blog.51cto.com/3652632/1294332	"6"
[7]:    	 http://alanwu.blog.51cto.com/3652632/1357875	"7"
[8]:    	 http://alanwu.blog.51cto.com/3652632/1391156	"8"
[9]:    	 http://alanwu.blog.51cto.com/3652632/1393068	"9"
[10]:    	 http://alanwu.blog.51cto.com/3652632/1393078	"10"
