---
layout: post
title: 使用 jmeter 做性能测试
description: 使用 badboy 录制脚本，jmeter 做性能测试
category: blog
tags: [jmeter, performance, test]
---
## 相关软件安装
Apache JMeter是Apache组织开发的基于Java的压力测试工具。用于对软件做压力测试，它最初被设计用于Web应用测试但后来扩展到其他测试领域。 它可以用于测试静态和动态资源例如静态文件、Java 小服务程序、CGI 脚本、Java 对象、数据库， FTP 服务器， 等等。JMeter 可以用于对服务器、网络或对象模拟巨大的负载，来自不同压力类别下测试它们的强度和分析整体性能。另外，JMeter能够对应用程序做功能/回归测试，通过创建带有断言的脚本来验证你的程序返回了你期望的结果。为了最大限度的灵活性，JMeter允许使用正则表达式创建断言。(摘自百度百科)

jmeter 有一个好搭档，那就是 badboy。 Badboy 是一款不错的 Web 自动化测试工具，如果你将它用于非商业用途，或者用于商业用途但是安装 Badboy 的机器数量不超过 5 台，你是不需要为它支付任何费用的。也许是一种推广策略， Badboy 提供了将 Web 测试脚本直接导出生成 JMeter 脚本的功能，并且这个功能非常好用，也非常简单。

你可以下载这两个软件

- [jmeter下载][]
- [badboy下载][]

jmeter 安装直接解压，我们安装 java 软件时最好不要安装的 path 有中文和空格，这样可以避免一些不必要的错误。badboy 的安装就和一般的 windows 安装一样。

## 测试案例
现以测试 kdtest.kdweibo.cn公网测试环境发送微博为列子，详细说明如何使用 badboy 和 jmeter。

### 录制脚本
安装上述软件后，打开 badboy

![](http://7tsy8h.com1.z0.glb.clouddn.com/badboy-recoding.png{{ site.watermark }})

输入 kdtest.kdweibo.cn，进入云之家首页，点击上图中的录制按钮，开始录制脚本。

![](http://7tsy8h.com1.z0.glb.clouddn.com/kdweibo-login.png{{ site.watermark }})

输入用户名和密码，点击登录。

![](http://7tsy8h.com1.z0.glb.clouddn.com/kdweibo-send-weibo.png{{ site.watermark }})

输入发送的微博，点击发送，发送成功后，点击录制脚本按钮，停止录制。

![](http://7tsy8h.com1.z0.glb.clouddn.com/badboy-export-jmeter.png{{ site.watermark }})

点击 file 菜单，选择 Export to Jmeter 导出 Jmeter 脚本，命名为 测试发送微博.jmx(后缀自动添加)。

### 脚本处理
在 Jmeter 安装目录下，点击 bin/jmeter.bat 打开 jmeter

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-open.png{{ site.watermark }})

点击文件 --> 打开，刚才用badboy 录制的脚本测试发送微博.jmx

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-opened.png{{ site.watermark }})

裁剪不需要测试的 url ，这次测试需要保留

- http://kdtest.kdweibo.cn/space/c/rest/user/login 用户微博登陆
- http://kdtest.kdweibo.cn/microblog/rest/microblog/send 发送微博

其余的可以删除。

因为 **登陆操作** 只需要执行一次即可，添加一个逻辑控制单元：

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-only-control.png{{ site.watermark }})

如图所示，在 Thread group 上点击右键，添加，逻辑控制器，仅一次控制器。命名为登陆，并且将 http://kdtest.kdweibo.cn/space/c/rest/user/login 拖入其中。

修改 step 控制器名称为 **发送微博**，并且勾选循环次数为永远。将 **登录** 这个控制器移动到发送微博控制器之 **前**，结果如图所示：

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-dealwith-script.png{{ site.watermark }})


点击选中 Thread Group 修改线程数为 100，代表同时有 100 个用户并发访问。修改 Ramp_Up Period 为 50 代表这 100 线程会在 50 秒钟启动完毕，即每秒启动 2 个线程，循环次数，代表每个线程执行采样的次数。可以勾选永远，使其不停的才采样，如图：

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-threads.png{{ site.watermark }})

点击 Test Plan 修改名称为 发送微博测试
右击 添加 --> 监听器，添加聚合报告，和察看结果树，这两个报告的作用分别为，察看结构树用来监控返回的结果是否符合预期，用来判断录制的脚本是否正确。聚合报告的作用为，统计这次测试的一些数据，如最大访问时间，最小访问时间，QPS 等。

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-testplan.png{{ site.watermark }})

### jmeter 测试脚本
完成以上工作后，可以点击运行按钮，在本地验证脚本的正确性。如下图所示。

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-run.png{{ site.watermark }})

## jmeter 中的内置函数
在测试中有可能会需要使用内置函数，如：
在 3 分钟内不能发送重复微博，这就不能在发送微博的文本中硬编码，可以在发送的文本中添加一个随机数，这时可以使用 ${__uuid()} 这样就能每次发送的消息都是不会相同。避免测试时不能重复使用。关于 Jmeter 内置的函数和变量，详情可以参考文档：

[http://jmeter.apache.org/usermanual/functions.html](http://jmeter.apache.org/usermanual/functions.html)


[jmeter下载]: [http://jmeter.apache.org/download_jmeter.cgi] "jmeter下载"
[badboy下载]: [http://www.badboy.com.au/download/add] "badboy下载"
[-10]:    http://hushi55.github.io/  "-10"
