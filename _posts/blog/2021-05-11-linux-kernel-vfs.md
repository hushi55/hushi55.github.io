---
layout: post
title: Virtual File System
description: linux kernel 系列之 vfs
category: blog
tags: [linux, kernel, vfs]
---
## vfs 介绍
 Unix 的设计哲学就是 `一切皆文件`，但是由于存在多种文件系统，如 FAT，ZFS，btrfs 等，
 为了保证用户层的视图统一， 就出现了 VFS。

## vfs 相关 API  
首先我们来看看于文件系统相关的一些对象，和对应的数据结构：

- 文件对象：file
- 挂载文件系统：
	- vfsmount：挂载点
	- super_block：文件系统
- 文件系统操作：super_operations
- 文件或者目录：dentry
- 文件或者目录操作：
	- file_operations：文件操作
	- inode_operaions：inode 操作
	- address_space_operations：数据和 page cache 操作

看完相关的数据结构，我们来看看各个结构是如何组织的：

![](http://myaut.github.io/dtrace-stap-book/images/linux/vfs.png)

我们根据上图来解释一下各个数据结构：

- 通过 task_struct 结构可以间接的访问到打开的文件列表，这个文件列表是一个数组，这个数组的容量非常巨大。
  数据的索引即我们常说的 file descriptor，数据的每个元素为 file 文件对象指针，
  上图可以注意到 f_mode 表明一个进程可以同时打开同一个文件两次， 一次为 O_RDONLY，一次为 O_RDWR。
  注意，这个文件的指针的最后两个 bit，一般被 kernel 内部使用。
- 一个文件可以通过两个对象来表示：
	- inode：表示自身的信息，如 i_uid，i_gid。
	- dentry：表示该文件的目录信息。
- linux 中的文件可以有多种，多个文件系统通过挂载点对象 vfsmount 来区分。

看完了 vfs 在 linux kernel 中的代码结构，我们来看看 vfs 使用时，kernel 内部都做了些什么操作：

![](http://myaut.github.io/dtrace-stap-book/images/vfsops.png)

- open：open system call 将创建一个 file 对象，并且在 open files tables 中分配一个索引。
  在这个之前，还会做一些其他的工作，首先通过查找 dentry cache 来确定这个 file 存在的位置。
  其次还包括一些鉴权工作。
- write：由于 block I/O 非常耗时，所有 linux 会使用 page cache 来缓存每次 read file 的内容，
  当 write system call 时，系统将这个 page 标记为 dirty，并且将这个 page 移动到 dirty list 上，
  系统会定时将这些 page flush 到磁盘上。

## 参考

- [Virtual File System](http://myaut.github.io/dtrace-stap-book/kernel/fs.html)

[-10]:    http://hushi55.github.io/  "-10"
