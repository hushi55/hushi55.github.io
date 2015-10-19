---
layout: post
title: block input output
description: linux kernel 系列之  block IO
category: code
tags: [linux, kernel]
---
## linux block I/O 介绍  

这是 linux kernel 系列中的 block I/O 系统介绍，我们首先来看看在 linux 系统中一个 block io 从产生到 disk 的路径。

![](http://myaut.github.io/dtrace-stap-book/images/bio.png)

scsi 层中各个函数的含义:

- scsi.ioentry : 创建一个新的 scsi package 
- scsi.iodispatching : 将一个 scsi package 发送到 scsi 的队列中
- scsi.ioexecute : 将 scsi package 传递到底层驱动中 
- scsi.iocompleted/scsi.iodone : 底层驱动生产一个终端表明一个 scsi package 完成

看完了一个 block I/O 的路径后，我们来看看 block I/O 在 linux 中的代码组织：

![](http://myaut.github.io/dtrace-stap-book/images/linux/bio.png)

对于上面的图片，我们来解释下：

- request_queue: 代表一个块设备的请求队列，所有对于这个块设备的 block I/O 都会存放在这个队列中。
- request: 代表一个 block I/O 请求。
- bio: 代表一个真正的 I/O 请求，一个 request 中可以有多个 bio 保存在一个双向队列中，例如：聚散式的 I/O。



## linux block I/O 在 systemtap 的跟踪 
熟悉了 linux block 的整体结构和代买的相关细节后，我们使用 systemtap 来验证下。看看几个 systemtap 的脚本

<pre class="nowordwrap">
#!/usr/bin/stap

global req_time%[25000], etimes

probe ioblock.request
{
  req_time[$bio] = gettimeofday_us()
}

probe ioblock.end
{
  t = gettimeofday_us()
  s =  req_time[$bio]
  delete req_time[$bio]
  if (s) {
    etimes[devname, bio_rw_str(rw)] <<< t - s
  }
}

/* for time being delete things that get merged with others */
probe kernel.trace("block_bio_frontmerge"),
      kernel.trace("block_bio_backmerge")
{
  delete req_time[$bio]
}

probe timer.s(10), end {
  ansi_clear_screen()
  printf("%10s %3s %10s %10s %10s\n",
         "device", "rw", "total (us)", "count", "avg (us)")
  foreach ([dev,rw] in etimes - limit 20) {
    printf("%10s %3s %10d %10d %10d\n", dev, rw,
           @sum(etimes[dev,rw]), @count(etimes[dev,rw]), @avg(etimes[dev,rw]))
  }
  delete etimes
}
</pre>

注意上面脚本中的两个探针，ioblock.request ioblock.end 的原型定义在

<pre class="nowordwrap">
[root@docker221 tapset]# pwd
/usr/share/systemtap-2.9-3823/share/systemtap/tapset

[root@docker221 tapset]# grep -e 'ioblock.request' -R *
linux/ioblock.stp: * probe ioblock.request - Fires whenever making a generic block I/O request.
linux/ioblock.stp:probe ioblock.request = kernel.function ("generic_make_request")
linux/ioblock.stp:	name = "ioblock.request"

[root@docker221 tapset]# grep -e 'ioblock.end' -R *
linux/ioblock.stp: * probe ioblock.end - Fires whenever a block I/O transfer is complete.
linux/ioblock.stp:probe ioblock.end = kernel.function("bio_endio")
linux/ioblock.stp:	name = "ioblock.end"

</pre>

可以看出

- ioblock.request：是内核函数 generic_make_request 的别名
- ioblock.end：是内核函数 bio_endio 的别名

我这是使用的源码安装的 systemtap，使用 yum 安装的 systemtap 的两个重要位置在

- /usr/share/doc/systemtap-client-2.6/examples：systemtap 自带示例脚本的目录
- /usr/share/systemtap/：systemtap 运行时的一些脚本，包括一些别名的定义

上面的介绍只是入个门，至于后续的深入分析，大家可以在实际中入到的问题大胆的使用 systemtap 自带的脚本进行跟踪，一方面提高自己的分析问题的能力，另一方面可以熟悉
systemtap 和 linux kernel 的架构。

## 参考

- http://myaut.github.io/dtrace-stap-book/kernel/bio.html

[-10]:    http://hushi55.github.io/  "-10"
