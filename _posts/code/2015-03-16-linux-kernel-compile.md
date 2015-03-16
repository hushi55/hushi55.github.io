---
layout: post
title: linux kernel compile
description: linux 内核编译
category: code
tags: [linux]
---
## kernel 编译步骤

<pre>
1、获取内核源码，解压至/usr/src
	# tar xf linux-3.13.5.tar.xz -C /usr/src
    # ln -sv /usr/src/linux-3.13.5  /usr/src/linux
2、配置内核特性(选择一种方法就可以了)
    make config：遍历选择所要编译的内核特性
    make allyesconfig：配置所有可编译的内核特性
    make allnoconfig：并不是所有的都不编译
    make menuconfig：打开一个文件窗口菜单(yum -y install ncurses-devel)
    make kconfig(KDE桌面环境下，并且安装了qt开发环境)
    make gconfig(Gnome桌面环境，并且安装gtk开发环境)
3、编译内核
    # make -j5 (5 代表同时并发几个，这样可以加快编译的速度，建议 cpu+1)
4、安装内核模块
    # make modules_install
5、安装内核
    # make install
6、验正并测试
    # cat /boot/grub/grub.conf
    查看新内核是否已经添加, 而后重启系统并测试
</pre>

## make 清除

<pre>
make clean
make mrproper
</pre>


## perf，systemtap 相关的参数

<pre>
# perf 支持 uprobe
CONFIG_UPROBES=y

# systemtap 支持 uspace 跟踪
CONFIG_UTRACE=y
</pre>

## 参考
- [vm 下编译 kernel 出现 could not find module xxxx ](http://smilejay.com/2013/11/kernel-install-error-could-not-find-module/)
- [centos 6 升级到 kernel 3 ](http://winotes.net/centos-64-upgrade-to-kernel-3x.html)
- [http://blog.csdn.net/doudou8486/article/details/6448630](http://blog.csdn.net/doudou8486/article/details/6448630)

[-10]:    http://hushi55.github.io/  "-10"
