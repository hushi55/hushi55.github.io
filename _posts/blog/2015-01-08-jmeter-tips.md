---
layout: post
title: jmeter tips
description: jmeter 测试使用较多和比较常用的技巧
category: blog
tags: [jmeter, test]
---
[上一篇文章]()中介绍了 jmeter 和 badboy 搭配使用。现在我们介绍下 jmeter 的一些隐性好用的方面。

## jmeter plugins
我们使用 jmeter 做性能测试时，会发现有时候 jmeter 的原生支持有时候也不是很好用，比如 jmeter 的图表报告就比较难看，这个时候我们可以使用  [jmeter-plugins](http://jmeter-plugins.org/)。我么可以去官方网站上下载，它包括下面几个类型的插件

- [Standard Set](http://jmeter-plugins.org/wiki/StandardSet/)
- [Extras Set](http://jmeter-plugins.org/wiki/ExtrasSet/)
- [Extras with Libs Set](http://jmeter-plugins.org/wiki/ExtrasWithLibsSet/)
- [WebDriver Set](http://jmeter-plugins.org/wiki/WebDriverSet/)
- [Hadoop Set](http://jmeter-plugins.org/wiki/HadoopSet/)

从 Extras Set 就包含了各种图表报告，在 Extras with Libs Set 中有 json 和 OAuth 协议的支持。

### 安装
我们只需要将下载的 plugins 解压到

<pre>apache-jmeter-2.11\lib\ext</pre>

即可。

## jmeter 测试非 http 协议
我们有时候测试可能不止是 http 协议或者 http 协议之上(如 OAuth1, OAuth2 等)的软件，如：自定义的协议，像自己设计的 IM 聊天系统，现在非常火的推送系统等。jmeter 也有相关的接口可以完成这种需求。我们可以自己自定义实现测试。首先我们只需要继承

<pre>
org.apache.jmeter.protocol.java.sampler.AbstractJavaSamplerClient
</pre>

我们可以看到 AbstractJavaSamplerClient 覆盖下面的这些方法。

<pre>
  /**
	* lable 属性将能显示在 jmeter 面板上
	*/
  private static String label = "im.test";

  /**
    * 执行runTest()方法前会调用此方法,可放一些初始化代码
    */
  public void setupTest(JavaSamplerContext context);

  /**
    * JMeter测试用例入口
    */
  public SampleResult runTest(JavaSamplerContext context);

  /**
    * JMeter界面中可手工输入参数,代码里面通过此方法获取
    */
  public Arguments getDefaultParameters();

  /**
    * JMeter 日志记录
    */
  protected Logger getLogger();
</pre>

完成我们自己的业务操作后，可以将其 export 为一个 jar 文件，我们将其放置在

<pre>
apache-jmeter-2.11\lib\ext
</pre>

目录下，打开 jmeter 我们能看到：

## jmeter 分布式测试
jmeter 做性能测试时候由于是 jvm 上的应用，那么这个就限制了不能够无限制的启动线程，那么这就会有限制，如：

- 我希望测试负载 100000 用户时
- 要测试一个 IM 集群支撑 50W 个 tcp 长连接

一个 jvm 一台机器貌似是不能满足需求的，因为一个 jvm 的内存是有限，开启一个 thread 默认就需要 1M 的内存，虽然这个是可以通过参数来调小。一台机器的端口号也是有限的，只有 65535 个。这个时候我们希望能有多台机器联合测试，jmeter 对于这个需求是满足的。jmeter 的分布式测试设计师 master-slave 的结构设计，其中一台作为 control 将自身的测试脚本通过 RMI 发送到 slave 中，slave 做实际的测试，然后将测试的结构通过 RIM 发送给 master，master 做统计分析报表的工作，当然你也可以让 master 也做测试的工作。只需要将本机的 ip 和 端口 也填入配置文件即可。jmeter 分布式的架构图下：

![](http://7tsy8h.com1.z0.glb.clouddn.com/jmeter-distributed-test.png{{ site.watermark }})

首先我们修改 slaver 的配置，找到如下文件

linux：
<pre>
apache-jmeter-2.9/bin/jmeter-server
</pre>

windows：
<pre>
apache-jmeter-2.9/bin/jmeter-server.bat
</pre>

修改如下：

<pre>
# One way to fix this is to define RMI_HOST_DEF below
#RMI_HOST_DEF=-Djava.rmi.server.hostname=xxx.xxx.xxx.xxx
RMI_HOST_DEF=-Djava.rmi.server.hostname=192.168.1.237

${DIRNAME}/jmeter ${RMI_HOST_DEF} -Dserver_port=${SERVER_PORT:-1099} -s -j jmeter-server.log "$@"
</pre>

其中 SERVER_PORT 后面指定就是端口号，启动 jmeter-server。

在 master 的机器中的

<pre>
apache-jmeter-2.9/bin/jmeter.properties
</pre>

文件中找到

<pre>
# Remote Hosts - comma delimited
#remote_hosts=192.168.1.221:1099,192.168.1.102:1099,localhost:1099,192.168.0.22:1099
remote_hosts=192.168.1.237:1099,192.168.1.237:1097,192.168.1.238:1099,192.168.1.238:1097
</pre>

添加上一步的机器 ip 和 端口，完成以上步骤我们就可以在 master 上控制上面填写的 ip:port 对用的机器了进行 jmeter 分布式测试了。

注意点：

- 注意 master slaver 的 jmeter 版本应该一致
- 可以调节 master slaver 中 jvm 的参数，不要让测试机器成为瓶颈
- 注意 slaver 的端口是否占用，防火墙等问题

## jmeter 参数化
我们着重来看看 jmeter csv 的参数化，步骤如下：

1.在本地磁盘下新建一个文本。比如：F:\test.txt 文件的内容如下：

<pre>
user,passwd
user1,passwd1
user2,passwd2
</pre>

2.右键点击 jmeter 中需要参数化的某个请求，选择添加——配置原件——CSV Data Set Config，会添加一个CSV Data Set Config，需要设置相关的一些内容，具体如下：

- Filename：文件名。指保存信息的文件目录，可以相对或者绝对路径（比如：F:\test.txt）
- Variable Names：参数名称(如：有几个参数，在这里面就写几个参数名称，每个名称中间用分隔符分割，分隔符在下面的“Delimitet”中定义，为了和文件中的“,”对应，这里也用“,”分割每个参数名，（比如：user,passwd）
- Delimitet：定义分隔符，这里定义某个分隔符，则在“Variable Names”用这里定义的分隔符分割参数。
- Recycle on EOF：是否循环读入，因为CSV Data Set Config一次读入一行，分割后存入若干变量中交给一个线程，如果线程数超过文本的记录行数，那么可以选择从头再次读入。

3.在需要使用变量的地方，比如在登录操作中，需要提交的表单字段包含用户名密码，我们就可以用 ${变量名} 的形式进行替换，例如 ${user}。


[-10]:    http://hushi55.github.io/  "-10"
