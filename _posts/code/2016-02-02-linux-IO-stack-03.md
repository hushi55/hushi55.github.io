---
layout: post
title: Linux IO Stack 系列 03
description: Linux IO 栈系列文章第三篇
category: code
tags: [linux, IO]
---
上篇中我们看了 IO 涉及到的主要的模块和大体的结构，这篇文章中我们来着重看看前半部分的过程，和主要的概念。
也就是后备存储器中的数据是怎么映射到内存中的？

为了回到这个问题，我们要知道 Linux 为了提升 IO 的性能，会尽可能的使用物理内存来做为后备存储的 cache，这就是我们常说的 page cache。
从后备存储中的数据映射到物理内存中，有一个和重要的概念，就是 address space：

![](/images/blog/io/linux_io_address_space.png)

通过 inode 可以找到地址空间，地址空间关联着后备存储和 page cache 的映射关系。page cache 的组织方式是通过 radix tree 来组织的。

知道了 page cache 的作用，我们就能回答第一篇中的两个问题了，我们知道有 cache 就涉及到 cache 数据的一致性问题，

- 那么什么时候将数据 flush 到磁盘？

Liunx 有两种方式，第一使用的后台守护进程在一定条件下，将数据 flush 到磁盘，第二，就是 application 写数据数的时候同步写磁盘。
其中第二中方式就是同步写，也就是同步 IO。若是我们不使用 page cache 的方式来操作 IO，那么就是 direct io。

## 参考

- 一个IO的传奇一生[1],[2],[3],[4],[5],[6],[7],[8],[9],[10]
- 深入 Linux 内核架构(德：Wolfgang Mauerer 著 郭旭 译)

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
