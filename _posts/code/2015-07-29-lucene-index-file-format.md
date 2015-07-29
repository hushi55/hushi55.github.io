---
layout: post
title: Lucene index file format
description: Lucene5.0 索引格式
category: code
tags: [Lucene]
---
## Introduction
Lucene 虽然首先是用 java 语言实现的，但是现在 Lucene 是一个多语言的，包括像 C，C++，.net 等都有实现，所以 Lucene 需要定义一个语言无关的 index 格式。

## Definitions
首先解释几个概念：index, document, field and term

index 是有多个 document 组成的。

- 一个 document 是有多个 field 组成的。
- 一个 field 是有多个 term 组成的。
- 一个 term 是有多个 bytes 组成的。

注意同样 bytes 组成的 term，但是在不同的 field 下，我们认为是两个不同的 term，也就是说，term 其实是一个 bytes 和 field 的二元组。

## Segments
一个 Lucene index 可能有多个 sub-index，或者 segments 组成。每一个  segments 一个单独的完整的 index，它可以单独的被搜索。
index 的产生过程：

- 当添加一个新的 documents 时会穿件一个 segments。
- 合并当前存在的 segments。

当搜索时，那么就可能牵涉到多个 index 或者多个 segments。而每一个 index 可能包括多个 segments。

## Document Numbers
Lucene 内部使用一个整型数字来引用一个 docs，第一个添加的 docs 是 0，以后每添加一个文档，数字增加 1。

注意 documents number 是可以改变的，当使用外部的数字来引用文档时，应该特别小。事实上，numbers 存在以下情况是可以改变的：

- 每个 segments 中的每个 documents number 是唯一的。一个标准的做法是，为每一个 segments 分配一个范围，从一个 documents number 转换成一个外部值时，需要这个 segments 的基数需要做加法，同样的从一个外部值转换为一个 segments 内部的 number 需要做减法。如：现在有两个 5 个 docs 的 segments 合并时，第一个 segments 的文档基数是从 0 开始，而第二个 segments 的文档基数就会是从 5 开始，第二个 segments 中的第三个 docs 的外部值将会是 8 。
- 当文档被删除时，documents 的编号将出现间隙，当合并 index 时，这些文档会被删除。


## Index Structure Overview
每一个  segments 包括以下内容：

- Segment info：这个包含一些元信息，如：documents 的数量，以及哪些文件使用这些信息。
- Field names：这个包含了组成 index 的一系类 field 的名称。
- Stored Field values：这是一些 key-value 对，key 是 field 的名称，它被用于存储 documents 的一些附加信息，如： title, url, 或者是进入 database 的标志。当每次搜索命中的时候，它们会返回。This is keyed by document number.(?)  
- Term dictionary：包含了所有 documents 中的所有 index field，也有这个 term 有多少个 documents 包含它，和词频和 term 在 documents 中的位置信息。
- Term Frequency data：每个在 dictionary 中的 term，包含它的所有 documents 有这个 term 在文档中出现的频率。除非指定  IndexOptions.DOCS_ONLY 选项。
- Term Proximity data：记录这个 term 在 documents 中的位置信息，除非 field 中忽略这个位置信息。
- Term Vectors. For each field in each document, the term vector (sometimes called document vector) may be stored. A term vector consists of term text and term frequency. To add Term Vectors to your index see the Field constructors
- Per-document values. Like stored values, these are also keyed by document number, but are generally intended to be loaded into main memory for fast access. Whereas stored values are generally intended for summary results from searches, per-document values are useful for things like scoring factors.
- Live documents：可选文件，表明那些文档是激活的。

## File Naming
属于同一个  segments 的所有文件有着同样的名称但是不同的后缀，不同的后缀有着不同的格式，当使用混合文件格式( >= 1.4 )时，除了 Segment info file, the Lock file, and Deleted documents file 将都存储在 .cfs 文件中。

一般的，同一个 index 的 segments 会存储在同一个目录下，但是这不是必须的。

2.1 版本中，文件时没有名称的，也就是说，任何文件存储在目录下不会使用名称，而是使用了一个简单的生成算法，第一个 segments 的文件命名为 segments_1，第二个 segments_2 以此类推。这个序列号使用 36 位编号。

## Summary of File Extensions
请看下面的表格：

名称 | 后缀 | 摘要
:-------------------|:-------------:|:-------------------
Segments File       | segments_N 	| 存储一次 commit 提交的信息。
Lock File 	        | write.lock 	| 防止多个 indexwrite 写同一文件的锁。
Segment Info        | .si 	        | 存储一个 segments 的元信息。
Compound File       | .cfs, .cfe 	| 所有 index 组成的一个可选虚拟的文件，经常用于文件处理之外
Fields 	            | .fnm 	        | 存储 field 的相关信息。
Field Index         | .fdx  	    | 包含指向 field data 的指针
Field Data 	        | .fdt 	        | 存储了 documents 的 field 
Term Dictionary     | .tim  	    | term 词典，存储 term 的信息
Term Index 	        | .tip  	    | term Dictionary 的 index
Frequencies 	    | .doc 	        | 由包含了 term 词频的 documents 组成
Positions 	        | .pos 		    | 存取 term 在 index 的位置信息
Payloads 	        | .pay 	        | 存储了可选的每个位置的元信息，如：每个字符的位置和用户负载
Norms 	            | .nvd, .nvm 	| docs 和 field 的编码长度 和 boost factors
Per-Document Values | .dvd, .dvm 	| 可选的 scoring factors 或者其他 per-documents 的信息
Term Vector Index 	| .tvx 	        | 储存 documentes 在 data file 中的位置偏移
Term Vector Documents |  	.tvd 	| Contains information about each document that has term vectors
Term Vector Fields 	| .tvf 	        | field 级别的 term vectors
Live Documents 	    | .liv 	        | 哪些文件是有用的

## Lock File
lock file 默认存放在和 index 同一个目录下，当 lock file 和 index 目录不同时，将会被命名为 "XXXX-write.lock"，XXXX 代表是的 index 存放目录的全路径。当有 lock file 存在时，表明当前正在修改 index，可能是添加或者删除 docs，lock file 主要是保证在同一时间只有一个写者。

## 参考
- [Lucene 5.0 index file format](https://lucene.apache.org/core/5_2_0/core/org/apache/lucene/codecs/lucene50/package-summary.html#package_description)
- [Lucene 索引文件学习笔记](http://www.cnblogs.com/zhouqing/archive/2012/11/25/2776366.html)

[-10]:    http://hushi55.github.io/  "-10"
