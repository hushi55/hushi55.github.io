---
layout: post
title: vfs
description: linux kernel 系列之 vfs
category: code
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

- 通过 task_struct 结构可以间接的访问到打开的文件列表，这个文件列表是一个数组，
  数据的索引即我们常说的 file descriptor，数据的每个元素为 file 文件对象指针，
  上图可以注意到 f_mode 表明一个进程可以同时打开同一个文件两次， 一次为 O_RDONLY，一次为 O_RDONLY。
- 一个文件可以通过两个对象来表示：
	- inode：表示自身的信息，如 i_uid，i_gid。
	- dentry：表示该文件的目录信息。
- linux 中的文件可以有多种，多个文件系统通过挂载点对象 vfsmount 来区分。

我们可以通过下面的 systemtap 脚本来验证上面的这个图中的信息：

```shell
stap -e '
    probe syscall.read { 
        file = @cast(task_current(), "task_struct")->
            files->fdt->fd[fd] & ~3; 
        if(!file) 
            next; 
        dentry = @cast(file, "file")->f_path->dentry;  
        inode = @cast(dentry, "dentry")->d_inode;
        
        printf("READ %d: file '%s' of size '%d' on device %s\n", 
            fd, d_name(dentry), @cast(inode, "inode")->i_size,
            kernel_string(@cast(inode, "inode")->i_sb->s_id)); 
    } '  -c 'cat /etc/passwd > /dev/null'
```

看完了 vfs 在 linux kernel 中的代码结构，我们来看看 vfs 使用时，kernel 内部都做了些什么操作：

![](http://myaut.github.io/dtrace-stap-book/images/vfsops.png)

- open：open system call 将创建一个 file 对象，并且在 open files tables 中分配一个索引。
  在这个之前，还会做一些其他的工作，首先通过查找 dentry cache 来确定这个 file 存在的位置。
  其次还包括一些鉴权工作。
- write：由于 block I/O 非常耗时，所有 linux 会使用 page cache 来缓存每次 read file 的内容，
  当 write system call 时，系统将这个 page 标记为 dirty，并且将这个 page 移动到 dirty list 上，
  系统会定时将这些 page flush 到磁盘上。

## vfs in systemtap
我们首先来看看 vfs 在 systemtap 中的已经定义的一些别名：

```shell
[root@docker221 tapset]# pwd
/usr/share/systemtap-2.9-3823/share/systemtap/tapset

[root@docker221 tapset]# grep 'probe vfs' -R linux/vfs.stp
probe vfs.do_sync_read = kernel.function("do_sync_read") !,
probe vfs.do_sync_read.return = kernel.function("do_sync_read").return !,
probe vfs.do_sync_write = kernel.function("do_sync_write") !,
probe vfs.do_sync_write.return = kernel.function("do_sync_write").return !,
probe vfs.block_sync_page = kernel.function("block_sync_page") ?
probe vfs.block_sync_page.return = kernel.function("block_sync_page").return ?
probe vfs.buffer_migrate_page = kernel.function("buffer_migrate_page") ?
probe vfs.buffer_migrate_page.return =
probe vfs.__set_page_dirty_buffers = kernel.function("__set_page_dirty_buffers")
probe vfs.__set_page_dirty_buffers.return =
probe vfs.do_mpage_readpage = kernel.function("do_mpage_readpage")
probe vfs.do_mpage_readpage.return = kernel.function("do_mpage_readpage").return
probe vfs.add_to_page_cache =
probe vfs.add_to_page_cache.return =
probe vfs.remove_from_page_cache =
probe vfs.remove_from_page_cache.return =
probe vfs.read = kernel.function("vfs_read")
probe vfs.read.return = kernel.function("vfs_read").return
probe vfs.readv = kernel.function("vfs_readv")
probe vfs.readv.return = kernel.function("vfs_readv").return
probe vfs.write = kernel.function("vfs_write")
probe vfs.write.return = kernel.function("vfs_write").return
probe vfs.writev = kernel.function("vfs_writev")
probe vfs.writev.return = kernel.function("vfs_writev").return
probe vfs.open = kernel.function("vfs_open") ?
probe vfs.open.return = kernel.function("vfs_open").return ?
```

## 参考

- [vfs](http://myaut.github.io/dtrace-stap-book/kernel/fs.html)

[-10]:    http://hushi55.github.io/  "-10"
