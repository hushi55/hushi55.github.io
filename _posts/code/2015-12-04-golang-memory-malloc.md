---
layout: post
title: Golang memory malloc
description: Golang 源码分析内存模块：内存分配
category: code
tags: [linux, Golang]
---
## 介绍
Golang 源码分析主要是基于 1.5.1 的64系统版本，主要目的是：

- 学习 Golang 语法后阅读 Golang 优秀工程，加深对 Golang 的理解
- 理解 Golang 的内部设计，帮助设计和写出高效的 Golang 代码

## Golang 内存模块的整体设计
Golang 的内存分配的设计起点很高，是基于 Google 自家的 [tcmalloc](http://google-perftools.googlecode.com/svn/trunk/doc/tcmalloc.html)设计的，
这个在 Golang runtime/malloc.go 的注释有详细说明。现在我基于阅读的 Golang 源码说说整体上的设计，首先我说说对于 Golang 内存模块的设计主要的作用：

- 高效率的内存管理，内存分配
- Golang 垃圾收集机制

高效内存管理一般的做法就是预先向操作系统分配一大块的内存，然后切块，应用程序自己管理。而垃圾收集机制就得查询到所有的对象，查看是否是可达的，这里的可达一般有两种算法，基于图的遍历算法，
基于计数器的算法，但是基于计数器的算法，要特别处理循环引用的情况。Golang 使用的基于图的遍历算法，使用 bitmap 来管理对象的状态。

说明了 Golang 的两个作用后，我们来看看联系这两功能的纽带： span。

![](/images/blog/go_mspan.png)

- next, pre 主要是自身构成双向的列表
- start 保存这个 page 的位置
- freelist 保存按照 elemsize 大小切割后的块，来保存 object 

说完了纽带，我们来看看 Golang 在内存中的整体布局，也就是 Golang 是怎么来组织整个内存的：

![](/images/blog/go_malloc_init.png)

- arena 部分是我们应用程序能够分配的所有内存
- bitmap 部分主要是以 8 byte 为单位来标记 arena 部分的内存状态，主要是用于 GC 部分
- spans 主要是 arena 部分以 page(8k) 为单位的指针，主要是用来合并 span，减少内存碎片

## 内存分配的重要组件
先来看看组件的整体视图：

![](/images/blog/go-mem-system-design.png)

- cache: 每个运行期作线程都会绑定一个 cache，用于无锁 object 分配。  
- central: 为所有 cache 提供切分好的后备 span 资源。  
- heap: 管理闲置 span，需要时向操作系统申请新内存。 

说一说这三级设计的主要目的：

cache的作用上面说的很明白，central 的主要作用是在多个 cache 中提高 object 的利用率，避免内存浪费。

`假如 cache1 获取一个 span 后，仅使用了部分 object，那么剩余空间就可能会被浪费。而回收操作将该 span 交还给 central 后，
该 span 完全可以被 cache2、cacheN 获取使用。此时，cache1 已不再持有该 span，完全不会造成问题。`

heap 的作用是为了平衡各种 object size 的需求。考虑下面的情形：

`某时段某种规格的 object 需求量可能激增，那么当需求过后，大量被切分成该规格的 span 就会 被闲置浪费。将归还给 heap，就可被其他需求获取，重新切分。`

## 分配算法分析
上面已经说明了 Golang 的这个内存布局和组件，我们现在来看看分配流程：

分配流程：  

- 计算待分配对象对应规格（size class）。  
- 从 cache.alloc 数组找到规格相同的 span。  
- 从 span.freelist 链表提取可用 object。  
- 如 span.freelist 为空，从 central 获取新 span。  
- 如 central.nonempty 为空，从 heap.free/freelarge 获取，并切分成 object 链表。  
- 如 heap 没有合适的闲置 span，向操作系统申请新内存块。  

释放流程：  

- 将标记为可回收 object 交还给所属 span.freelist。  
- 该 span 被放回 central，可供任意 cache 重新获取使⽤。  
- 如 span 已收回全部 object，则将其交还给 heap，以便重新切分复用。  
- 定期扫描 heap 里长时间闲置的 span，释放其占用的内存

大体上的流程都是 

`cache 组件 --> central 组件 --> heap 组件 --> 操作系统` 

![](/images/blog/go_malloc_algorithm.png)

注意上图中的红色部分，object size 为 8 字节的都是指针对象，所以可以作为图遍历算法的 root 对象。关于 GC 部分，
会在下一篇 blog 中来说明。 

## 参考

- skoo's notes [sk_1], [sk_2], [sk_3], [sk_4]
- [Golang 1.5 源码剖析](http://weibo.com/1908162493/D4FvGmfps?type=comment#_loginLayer_1449213947861)

[sk_1]:    http://skoo.me/go/2013/10/08/go-memory-manage-system-design/  "Go语言内存分配器设计"
[sk_2]:    http://skoo.me/go/2013/10/09/go-memory-manage-system-fixalloc/  "Go语言内存分配器-FixAlloc"
[sk_3]:    http://skoo.me/go/2013/10/11/go-memory-manage-system-span/  "Go语言内存分配器-MSpan"
[sk_4]:    http://skoo.me/go/2013/10/13/go-memory-manage-system-alloc/  "Go语言内存分配器的实现"

[-10]:    http://hushi55.github.io/  "-10"
