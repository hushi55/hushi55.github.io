---
layout: post
title: memcached
description: 介绍 memcached 的内部实现和运维相关的知识
category: blog
tags: [memcahed, liunx]
---
## memcached 内部结构
memcached 默认情况下采用了名为 Slab Allocator 的机制分配、 管理内存。在该机制出现以前，内存的分配是通过对所有记录简单地进行 malloc 和 free 来进行的。 但是，这种方式会导致内存碎片，加重操作系统内存管理器的负担，最坏的情况下，会导致操作系统比 memcached 进程本身还慢。 Slab Allocator 就是为解决该问题而诞生的。

### Slab Allocator
下面来看看 Slab Allocator 的原理。 下面是 memcached 文档中的 slab allocator 的目 标：

>the primary goal of the slabs subsystem in memcached was to eliminate memory fragmentation issues totally by using fixed­size memory chunks coming from a few predetermined size classes.

也就是说， Slab Allocator 的基本原理是按照预先规定的大小，将分配的内存分割成特定长度的块，以完全解决内存碎片问题。
Slab Allocation 的原理相当简单。 将分配的内存分割成各种尺寸的块（ chunk）， 并把尺寸相同的块
分成组（ chunk 的集合）。如图所示：

![](http://7tsy8h.com1.z0.glb.clouddn.com/memcached-slab-allocation.png{{ site.watermark }})

而且， slab allocator 还有重复使用已分配的内存的目的。也就是说，分配到的内存不会释放，而是重复利用。

Slab Allocation 的主要术语

- Page：分配给 Slab 的内存空间， 默认是 1MB。分配给 Slab 之后根据 slab 的大小切分成 chunk。
- Chunk：用于缓存记录的内存空间。
- Slab Class：特定大小的 chunk 的组。

Slab 的整体视图如下：

![](http://7tsy8h.com1.z0.glb.clouddn.com/slab.png{{ site.watermark }})

## memcached 运维
memcached 有个名为 stats 的命令，使用它可以获得各种各样的信息。 执行命令的方法很多，用 telnet 最为简单：

```shell
telnet localhost 11211
```

可以使用的命令包括：

```shell
stats
stats settings
stats items
stats sizes
stats slabs
```

stats 命令中的统计项解释：

![](http://7tsy8h.com1.z0.glb.clouddn.com/memcached-stat.png{{ site.watermark }})

stats slabs 中的统计项解释：

![](http://7tsy8h.com1.z0.glb.clouddn.com/memcached-stat-sbals.png{{ site.watermark }})

### memcached-tool
我们监控 memcached，可能使用的最多的还是 memcached-tool 工具，MySQL 安装下就有提供该工具，可以[戳这里](http://dev.mysql.com/doc/refman/5.0/en/ha-memcached-stats-memcached-tool.html)。我们可以看看这个工具的使用：

```shell
[root@centos101 hushi]# ./memcached-tool
Usage: memcached-tool <host[:port] | /path/to/socket> [mode]

memcached-tool 10.0.0.5:11211 display # shows slabs
memcached-tool 10.0.0.5:11211 # same. (default is display)
memcached-tool 10.0.0.5:11211 stats # shows general stats
memcached-tool 10.0.0.5:11211 settings # shows settings stats
memcached-tool 10.0.0.5:11211 sizes # shows sizes stats
memcached-tool 10.0.0.5:11211 dump # dumps keys and values

WARNING! sizes is a development command.
As of 1.4 it is still the only command which will lock your memcached instance for some time.
If you have many millions of stored items, it can become unresponsive for several minutes.
Run this at your own risk. It is roadmapped to either make this feature optional
or at least speed it up.
```

```shell
[root@centos101 hushi]# ./memcached-tool 127.0.0.1
  # Item_Size   Max_age   Pages   Count   Full?  Evicted Evict_Time  OOM
  1      96B  12032678s       3    4200      no        0        0    0
  2     120B  12032679s       4    3740      no        0        0    0
  3     152B  12458315s       1       2      no        0        0    0
  4     192B  12457805s       1       4      no        0        0    0
  5     240B      6688s     347 1512206      no        0        0    0
  6     304B         0s       1       0      no        0        0    0
  7     384B  12457935s       1       5      no        0        0    0
  8     480B   9244566s      41   33975      no        0        0    0
  9     600B   3911191s     401   22407      no        0        0    0
 10     752B   9694387s    1076 1498836      no        0        0    0
 11     944B   9763587s    1320  660284      no        0        0    0
 12     1.2K   9763594s     388   28233      no        0        0    0
 13     1.4K   3832521s      57   31260      no        0        0    0
 14     1.8K   3829445s      26   13101      no        0        0    0
 15     2.3K   3830666s       7    2295      no        0        0    0
 16     2.8K   3910953s       6     943      no        0        0    0
 17     3.5K   9694034s       4     260      no        0        0    0
 18     4.4K   9694405s       3      40      no        0        0    0
 19     5.5K  12458139s       3       2      no        0        0    0
 20     6.9K         0s       2       0      no        0        0    0
 21     8.7K  12459836s       2       1      no        0        0    0
 22    10.8K  12457936s       1       2      no        0        0    0
 23    13.6K         0s       1       0      no        0        0    0
 24    16.9K         0s       1       0      no        0        0    0
 25    21.2K         0s       1       0      no        0        0    0
 26    26.5K         0s       1       0      no        0        0    0
 27    33.1K         0s       1       0      no        0        0    0
 28    41.4K         0s       1       0      no        0        0    0
 29    51.7K         0s       1       0      no        0        0    0
 30    64.7K         0s       1       0      no        0        0    0
 31    80.9K         0s       1       0      no        0        0    0
 38   385.6K         0s       1       0      no        0        0    0
[root@centos101 hushi]#
```

各列的解释如下：

- \#: The slab number
- Item_Size: The size of the slab
- Max_age: The age of the oldest item in the slab
- Pages: The number of pages allocated to the slab
- Count: The number of items in this slab
- Full?: Whether the slab is fully populated
- Evicted: The number of objects evicted from this slab
- Evict_Time: The time (in seconds) since the last eviction
- OOM: The number of items that have triggered an out of memory error

### memcached 清空缓存
我们要清空 memcached 的缓存时，不用重启服务，可以使用下面的命令：

```shell
flush_all
```

[-10]:    http://hushi55.github.io/  "-10"
