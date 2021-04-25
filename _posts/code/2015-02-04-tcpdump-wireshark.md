---
layout: post
title: tcpdump 和  wireshark 联合调试问题
description: 使用 solr 时使用网页和 java client 调用结果不同的问题分析与解决
category: code
tags: [tcpdump, wireshark, linux]
---
## 遇到的问题
今天同事遇到一个问题，在是用 solr 搜索时，在程序中搜索出来的结果没有，但是使用 solr 提供的网页搜索界面搜索出来但是有 2 条结果。跟踪程序源代码时发现程序中也是通过 httpclient 发送的 http 请求，那么理论上也该能够搜索出结果，所以初步怀疑是 httpclient get 请求时参数太长被截断了，因为我们在 solr 中的 fq 字段填入了如下数据：

```shell
network:52a05d2d1a06f6672bc4b912
network:52a05ca71a06f6672bc4b883
network:52a05c701a06f6672bc4b863
network:52a05c5b1a06f6672bc4b842
network:52a05b081a06f6672bc4b6d7
network:52a05a7e1a06f6672bc4b648
network:51dd272e24ac20158506aa00
network:4f2a3e6324ac69d59b32c7fd
network:52aedac224acbf6fe02c5a4c
network:449305
network:323445
network:5346617f24acefd56b02b7f9
network:5316d87824acaeca0a3f4bfd
network:54ade69ae4b02c4d220cdedf
network:383cee68-cea3-4818-87ae-24fb46e081b1
network:54c5acb1e4b0b519b1987e22
network:54c0c53ce4b0adbfbaa2b1cb
network:54c0c252e4b00697574616ff
network:54c0c07ce4b017e0c9c26631
network:54c0bb59e4b0a37dc616a789
network:54bcb0cfe4b0b8e8f7f6cca8
network:54a2043de4b06930e0ed4137
network:54a20403e4b06930e0ed411a
network:54a20428e4b06930e0ed4129
network:547d68c1e4b0651f9fbd4c25
network:493003
network:325310
participants:4e420a24cce7a2ad930fc948
```

既然是这样那么我们只需要比对 solr 网页端的  tcp 包和程序发送的 tcp 包是不是一样就应该能找出问题。

## windows http 请求包
在 windows 上我们抓取 http 请求的方法有很多，如：

- chrome，firefox 自带的调试工具
- httpwatch 专业的代理工具，专业版收费
- [charles](http://www.charlesproxy.com/)
- windows 抓包神器 [wireshark](https://www.wireshark.org/download.html)

我们就使用 firefox 自带的调试工具就可以了。

## linux 下的抓包软件 tcpdump
在 linux 和 unix 下首推的就是 tcpdump 这个抓包软件，至于这个命令如何使用，可以参考 man 手册。我们使用在如下命令抓取 tcp 的包：

```shell
tcpdump -i lo dst port 10195 -o solr.cap
```

- -i：指定 lo 网卡
- dst port 10195：指定抓取目标端口为 10195 的包
- -o solr.cap：将抓到的包写入 solr.cap 文件中

为什么这里使用 lo 这个本地网卡，是因为我们的 solr 和 服务器都部署在一个台机器上，即使我们使用的 192.168.x.x 这个 ip，还是会走 lo 这个本地网卡。

## linux 下抓到的包可视化
当我们在 linux 下使用 tcpdump 抓到包后就剩下分析，我们使用 wireshark 在 windows 下来分析，首先我们将 linux solr.cap 文件拷贝到 windows 下，使用 wireshark 打开。有时候我们可能抓到的包会很多，这个时候就需要使用 wireshark 的过滤功能找到我们要的信息，不清楚可以 google。现在我们先来看看在 firefox 下的 http 请求的格式：

![](http://7tsy8h.com1.z0.glb.clouddn.com/tcpdump-wireshark-firefox.jpg{{ site.watermark }})

注意右边面板中 params 中的 fq 参数，这里是只有一个  fq 参数。

而在 linux 服务器上的 http 请求格式是：

![](http://7tsy8h.com1.z0.glb.clouddn.com/tcpdump-wireshark.png{{ site.watermark }})

注意红色部分标示的，这里的 fq 参数变成了多个了，这显然是使用 java httpclient 发送请求时参数格式拼写错误了。修改程序代码后使用网页端接口和程序的搜索结果就一致了，至此问题也就完美解决了。


[-10]:    http://hushi55.github.io/  "-10"
