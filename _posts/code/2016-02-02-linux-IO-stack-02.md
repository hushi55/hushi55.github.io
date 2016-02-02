---
layout: post
title: Linux IO Stack 系列 02
description: Linux IO 栈系列文章第二篇
category: code
tags: [linux, IO]
---
这篇文章我们主要看看 Linux IO 栈主要大体结构，也就是主要涉及的模块：

![](/images/blog/io/linux_io_block_device.png)

我们根据上图的总体结构来解释下经过的流程：

- 首先应用程序发起 IO 操作是在用户空间
- VFS 层是 Linux 的虚拟文件系统，提供统一的文件系统视图
- VFS 通过文件操作找到 inode 节点，通过 inode 节点就可以找到通用的 block device
- 通用的 block device 中有个很重的操作，就是利用 io 请求队列对 io 重排序

上面我们在 io 重排序上打上了星号，我们就在看看 io 重排序涉及到的视图总览：

![](/images/blog/io/linux_io_bio.png)

- 通过通用磁盘可以找到请求队列
- 请求队列中存放的就是 IO 请求
- 一个 IO 请求就是我们应用层发起 IO 操作操作时对 page cache 的操作

注意一个 BIO 其实是 page cache 的一个视图，因为 linux 为了提高性能，对 IO 的操作可能只是一个 page 中的少量数据，
所以使用了这样的组织方式。

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
