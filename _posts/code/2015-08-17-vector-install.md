---
layout: post
title: vector install
description: Netflix 性能监控系统 vector 的安装
category: code
tags: [performance,monitoring]
---
Vector 是美国 netflix 公司用来监控性能的工具，这个工具主要是解决工程师需要登录到各个服务器器上来执行各种命令来查看系统的一些信息。 
Vector 这种工作变得更加简单高效。 

## pcp

### pcp 介绍
首先我们来看看 pcp 的架构图

![](https://raw.githubusercontent.com/wiki/Netflix/vector/img/architecture.png)

可以看到 vector 只是代理，将请求还是会转发给 pcp 的 web daemon 进程，关于 web daemon 这个进程那么是每台上面都装，还是有个中心的 web daemon 呢?
在 pcp 的部署模式就可以选择在每台机器上启动 pmwebd 和 pmcd 服务，也可以使用中心 pmwebd 服务使用 tcp 链接各个 host 中的 pmcd 来获取各个 agent 的统计信息。

### pcp 安装
这里我的介绍是基于 centos7 的 pcp 安装方式，这其中包括两种方式的安装，rpm 安装方式和源码编译安装，注意貌似 rpm 安装不包括 pmwebd 这个命令，因此需要 pmwebd daemon 
进程的机器上就需要源码编译安装了。

rpm 安装的命令如下：

<pre>
yum install pcp
# RHEL 7 / Fedora
systemctl start pmcd
systemctl start pmlogger
</pre>

源码安装方式的操作如下：

首先装 gcc，make 等工具：
<pre>
yum groupinstall "Development Tools"
</pre>

其次安装 perl 的 dev 包

<pre>
yum install -y perl-devel 
</pre>

最后我们安装 pcp 的依赖包：

<pre>
## install yum-builddep
yum provides yum-builddep
yum install -y yum-utils-1.1.31-29.el7.noarch

yum-builddep -y pcp
</pre>


安装所有的依赖后，我们下载最新的 [pcp 的源码](https://bintray.com/pcp/source)，解压后到相应的目录：

<pre>
## add user
groupadd -r pcp && useradd -c "Performance Co-Pilot" -g pcp -d /var/lib/pcp -M -r -s /usr/sbin/nologin pcp

./configure --prefix=/usr --sysconfdir=/etc --localstatedir=/var --with-webapi

make -j8 && make install
</pre>

安装成功后，我们启动 pmcd 后台进程

<pre>
systemctl start pmcd
systemctl start pmlogger
</pre>

## vector 

### vector 安装
首先安装 [nodejs](https://nodejs.org/download/),我们需要下载对应的 nodejs 安装包，解压后，将 nodejs 的 bin 目录加入 PATH 中。

安装 [bower](http://bower.io/#install-bower)，我们下面的安装会使用到 bower，使用下面的命令安装

<pre>
npm install -g bower
</pre>

使用 npm 安装后，在 nodejs bin 目录下将会多出来 bower 文件。

我们还需要安装 gulp,我们可以使用下面的命令安装

<pre>
npm install --global gulp
npm install --save-dev gulp
</pre>

最后我们下载最新稳定的 vector 并且解压，cd 到 vector 的目录下执行如下命令：

<pre>
npm install
bower install --allow-root
gulp build
</pre>

注意由于国内网络的原因，可能会是吧，失败后多执行几次，直到成功为止。安装成功后，我们就可以启动 vector 了

<pre>
gulp serve
</pre>

这么启动的默认端口是 3000。

启动 vector 后我们就可以启动，pmwebd 进程了，我们使用如下命令启动

<pre>
/usr/libexec/pcp/bin/pmwebd -R dist -p 44323
</pre>

启动完成后，我们就可以在浏览其中访问 vector 了。那么将看到如下所有的图

![](https://raw.githubusercontent.com/wiki/Netflix/vector/img/screenshot.png)

当前的 widgets 有： 

- CPU
    - Load Average
    - Runnable
    - CPU Utilization
    - Per-CPU Utilization
    - Context Switches
- Memory
    - Memory Utilization
    - Page Faults
- Disk
    - Disk IOPS
    - Disk Throughput
    - Disk Utilization
    - Disk Latency
- Network
    - Network Drops
    - TCP Retransmits
    - TCP Connections
    - Network Throughput
    - Network Packets

### vector roadmap
vector 还处于开发中，netflix 还将添加一些新特性,我们可以关注下：

- More widgets and dashboards
- User-defined dashboards
- Metric snapshots
- CPU Flame Graphs
- Disk Latency Heat Maps
- Integration with [Servo](https://github.com/Netflix/servo)
- Support for Cassandra


## 错误
关于安装过程中出现的一些错误

<pre>
ExtUtils::MM_Unix::tool_xsubpp : Can't find xsubpp at /usr/local/share/perl5/ExtUtils/MM_Unix.pm line 3595.
</pre>

可以安装 

<pre>
yum install -y perl-devel 
</pre>


## 参考
- [perl error](http://stackoverflow.com/questions/27747568/getting-cant-find-xsubpp-at-usr-lib-perl5-5-10-0-extutils-mm-unix-pm-error-w)
- [vector](https://github.com/Netflix/vector/wiki/Getting-Started)
- [vector on host](http://techblog.netflix.com/2015/04/introducing-vector-netflixs-on-host.html)
- [pcp install](https://github.com/Netflix/vector/wiki/Installing-Performance-Co-Pilot)

[-10]:    http://hushi55.github.io/  "-10"
