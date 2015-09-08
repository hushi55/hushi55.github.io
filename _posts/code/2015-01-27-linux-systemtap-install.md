---
layout: post
title: liunx systemtap install
description: liunx systemtap install 遇到一些问题
category: code
tags: [systemtap, tools, linux]
---
## 安装
我的安装是在 centos 上实验的，我们可以使用

<pre>
yum install systemtap systemtap-runtime
</pre>

## 验证
安装完后我们可以是会用下面的命令来验证是否安装成功：

<pre>
## test kernel debug symbol info
stap -v -e 'probe vfs.read {printf("read performed\n"); exit()}'

## test user space debug 
stap -e  'probe process("ls").function("*").call { log (probefunc()." ".$$parms) }' -c 'ls -l'

</pre>

若是一切顺利，我们看到下面的输出，这表明成功安装了：

<pre class="nowordwrap">
[root@perf01 ~]# stap -v -e 'probe vfs.read {printf("read performed\n"); exit()}'
Pass 1: parsed user script and 103 library script(s) using 201324virt/29240res/3140shr/26600data kb, in 430usr/40sys/469real ms.
Pass 2: analyzed script: 1 probe(s), 1 function(s), 3 embed(s), 0 global(s) using 293676virt/122532res/4116shr/118952data kb, in 3070usr/390sys/3464real ms.
Pass 3: translated to C into "/tmp/stap424ZlL/stap_58ea609bf05d2a52a3426004df9f777f_1424_src.c" using 293676virt/122864res/4448shr/118952data kb, in 10usr/10sys/16real ms.
Pass 4: compiled C into "stap_58ea609bf05d2a52a3426004df9f777f_1424.ko" in 14360usr/2790sys/17154real ms.
Pass 5: starting run.
read performed
Pass 5: run completed in 20usr/60sys/403real ms.
[root@perf01 ~]#
</pre>

## 遇到的问题

### kernel-devel 版本问题
我在实验时遇到的问题是，验证时出现下面的输出：

<pre class="nowordwrap">
[root@perf01 ~]# stap -v -e 'probe vfs.read {printf("read performed\n"); exit()}'
Checking "/lib/modules/2.6.32-358.el6.x86_64/build/.config" failed with error: No such file or directory
Incorrect version or missing kernel-devel package, use: yum install kernel-devel-2.6.32-358.el6.x86_64
[root@perf01 ~]#
</pre>

我们列出提示的目录：

<pre class="nowordwrap">
[root@perf01 ~]# ll /lib/modules/2.6.32-358.el6.x86_64/
total 3408
lrwxrwxrwx.  1 root root     46 Sep 25 17:55 build -> ../../../usr/src/kernels/2.6.32-358.el6.x86_64
drwxr-xr-x.  2 root root   4096 Feb 22  2013 extra
drwxr-xr-x. 11 root root   4096 Sep 25 17:55 kernel
-rw-r--r--.  1 root root 566961 Sep 25 17:59 modules.alias
-rw-r--r--.  1 root root 546171 Sep 25 17:59 modules.alias.bin
-rw-r--r--.  1 root root   1369 Feb 22  2013 modules.block
-rw-r--r--.  1 root root     69 Sep 25 17:59 modules.ccwmap
-rw-r--r--.  1 root root 196799 Sep 25 17:59 modules.dep
-rw-r--r--.  1 root root 287191 Sep 25 17:59 modules.dep.bin
-rw-r--r--.  1 root root     68 Feb 22  2013 modules.drm
-rw-r--r--.  1 root root    665 Sep 25 17:59 modules.ieee1394map
-rw-r--r--.  1 root root    141 Sep 25 17:59 modules.inputmap
-rw-r--r--.  1 root root   1236 Sep 25 17:59 modules.isapnpmap
-rw-r--r--.  1 root root     29 Feb 22  2013 modules.modesetting
-rw-r--r--.  1 root root   1905 Feb 22  2013 modules.networking
-rw-r--r--.  1 root root     74 Sep 25 17:59 modules.ofmap
-rw-r--r--.  1 root root  74887 Feb 22  2013 modules.order
-rw-r--r--.  1 root root 405140 Sep 25 17:59 modules.pcimap
-rw-r--r--.  1 root root   6259 Sep 25 17:59 modules.seriomap
-rw-r--r--.  1 root root 215776 Sep 25 17:59 modules.symbols
-rw-r--r--.  1 root root 274276 Sep 25 17:59 modules.symbols.bin
-rw-r--r--.  1 root root 837314 Sep 25 17:59 modules.usbmap
lrwxrwxrwx.  1 root root      5 Sep 25 17:55 source -> build
drwxr-xr-x.  2 root root   4096 Feb 22  2013 updates
drwxr-xr-x.  2 root root   4096 Sep 25 17:55 vdso
drwxr-xr-x.  2 root root   4096 Feb 22  2013 weak-updates
[root@perf01 ~]#
</pre>

可以看到 build 是各一个软连接，我们再列出来提示的目录：

<pre class="nowordwrap">
[root@perf01 ~]# ll /usr/src/kernels/
total 4
drwxr-xr-x. 22 root root 4096 Jan 10 03:00 2.6.32-504.3.3.el6.x86_64
[root@perf01 ~]#
</pre>

我们看看我们 kernel 的版本：

<pre>
[root@perf01 ~]# uname -r
2.6.32-358.el6.x86_64
[root@perf01 ~]#
</pre>

显然是版本对不上，安装的 kernel 源码要新，我们可以卸载掉，使用 rpm 包重新安装

<pre>
yum remove kernel-devel
</pre>

卸载之后，我们可以上  google 查找我们内核版本的 kernel-devel-2.6.32-358.el6.x86_64 rpm 包。下载以后使用命令安装：

<pre>
rpm -ivh kernel-devel-2.6.32-358.el6.x86_64.rpm
</pre>

### 内核符号信息
上面的内核版本安装完成后使用上面的检查命令检查

<pre class="nowordwrap">
[root@perf01 ~]# stap -v -e 'probe vfs.read {printf("read performed\n"); exit()}'
Pass 1: parsed user script and 103 library script(s) using 201324virt/29244res/3140shr/26600data kb, in 450usr/30sys/508real ms.
semantic error: while resolving probe point: identifier 'kernel' at /usr/share/systemtap/tapset/linux/vfs.stp:768:18
        source: probe vfs.read = kernel.function("vfs_read")
                                 ^

semantic error: missing x86_64 kernel/module debuginfo [man warning::debuginfo] under '/lib/modules/2.6.32-358.el6.x86_64/build'
semantic error: while resolving probe point: identifier 'vfs' at &lt;input&gt;:1:7
        source: probe vfs.read {printf("read performed\n"); exit()}
                      ^

semantic error: no match
Pass 2: analyzed script: 0 probe(s), 0 function(s), 0 embed(s), 0 global(s) using 206720virt/34572res/5136shr/29892data kb, in 110usr/410sys/529real ms.
Pass 2: analysis failed.  [man error::pass2]
[root@perf01 ~]#
</pre>

出现 semantic error 表明是系统没有符号信息，我们需要手动的安装符号 rpm，我们可以上 [http://debuginfo.centos.org](http://debuginfo.centos.org) 查找

- kernel-debuginfo-common-\`uname -r\`
- kernel-debuginfo-\`uname -r\`

下载好，使用 rpm 命令安装即可：

<pre>
rpm -ivh kernel-debuginfo-*.rpm
</pre>

### 其他问题
安装完后可能还会有这样的错误：

<pre>
	...
/usr/src/kernels/2.6.32-358.el6.x86_64/arch/x86/include/asm/atomic_64.h:21: note: expected ‘const struct atomic_t *’ but argument is of type ‘int’
/tmp/stapsc5jB6/stap_828df21dec234dbb5079577b35750b2c_1424_src.c:848: error: implicit declaration of function ‘skipped_count_reentrant’
/tmp/stapsc5jB6/stap_828df21dec234dbb5079577b35750b2c_1424_src.c:848: error: passing argument 1 of ‘atomic_read’ makes pointer from integer without a cast
/usr/src/kernels/2.6.32-358.el6.x86_64/arch/x86/include/asm/atomic_64.h:21: note: expected ‘const struct atomic_t *’ but argument is of type ‘int’
/tmp/stapsc5jB6/stap_828df21dec234dbb5079577b35750b2c_1424_src.c:849: error: passing argument 1 of ‘atomic_read’ makes pointer from integer without a cast
/usr/src/kernels/2.6.32-358.el6.x86_64/arch/x86/include/asm/atomic_64.h:21: note: expected ‘const struct atomic_t *’ but argument is of type ‘int’
	...
</pre>

这是因为我们使用

<pre>
yum remove kernel-devel
</pre>

把

- systemtap-2.5-5.el6.x86_64.rpm
- systemtap-devel-2.5-5.el6.x86_64.rpm

这两个 rpm 包也给卸载了，我们只需要使用上面的命令重新安装 systemtap 即可。

## 参考
- [https://www.sourceware.org/systemtap/SystemTap_Beginners_Guide/using-systemtap.html](https://www.sourceware.org/systemtap/SystemTap_Beginners_Guide/using-systemtap.html)

[-10]:    http://hushi55.github.io/  "-10"
