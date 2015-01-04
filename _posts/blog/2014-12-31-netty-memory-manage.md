---
layout: post
title:  netty 内存管理
description: netty 内存管理-手动内存管理
category: blog
---
>**C/C++ 和 java 中有个围城，城里的想出来，城外的想进去！**

这个围城就是自动内存管理！

## Netty 4 buffer 介绍
Netty4 带来一个与众不同的特点是其 ByteBuf 的实现，相比之下，通过维护两个独立的读写指针，
要比 io.netty.buffer.ByteBuf 简单不少，也会更高效一些。不过，Netty 的 ByteBuf
带给我们的最大不同，就是他不再基于传统 JVM 的 GC 模式，相反，它采用了类似于 C++ 中的 malloc/free
的机制，需要开发人员来手动管理回收与释放。从手动内存管理上升到GC，是一个历史的巨大进步，
不过，在20年后，居然有曲线的回归到了手动内存管理模式，正印证了马克思哲学观：
**社会总是在螺旋式前进的，没有永远的最好。**

### GC 内存管理分析
的确，就内存管理而言，GC带给我们的价值是不言而喻的，不仅大大的降低了程序员的心智包袱，
而且，也极大的减少了内存管理带来的Crash困扰，为函数式编程（大量的临时对象）、脚本语言编程带来了春天。
并且，高效的GC算法也让大部分情况下程序可以有更高的执行效率。
不过，也有很多的情况，可能是手工内存管理更为合适的。譬如：

- 对于类似于业务逻辑相对简单，譬如网络路由转发型应用（很多erlang应用其实是这种类型），
但是 QPS 非常高，比如1M级，在这种情况下，在每次处理中即便产生1K的垃圾，都会导致频繁的GC产生。
在这种模式下，erlang的按进程回收模式，或者是C/C++的手工回收机制，效率更高。
- Cache型应用，由于对象的存在周期太长，GC基本上就变得没有价值。

所以，理论上，尴尬的GC实际上比较适合于处理介于这2者之间的情况：
对象分配的频繁程度相比数据处理的时间要少得多的，但又是相对短暂的，
典型的，对于OLTP型的服务，处理能力在1K QPS量级，每个请求的对象分配在10K-50K量级，
能够在5-10s的时间内进行一次younger GC，每次GC的时间可以控制在10ms水平上，
这类的应用，实在是太适合GC行的模式了，而且结合Java高效的分代GC，简直就是一个理想搭配。

### 对 JVM 生态的影响
Netty 4 引入了手工内存的模式，我觉得这是一大创新，这种模式甚至于会延展，
应用到Cache应用中。实际上，结合JVM的诸多优秀特性，如果用Java来实现一个Redis型Cache、
或者 In-memory SQL Engine，或者是一个Mongo DB，我觉得相比C/C++而言，都要更简单很多。
实际上，JVM也已经提供了打通这种技术的机制，就是Direct Memory和Unsafe对象。
基于这个基础，我们可以像C语言一样直接操作内存。实际上，Netty4的ByteBuf也是基于这个基础的。

## Jemalloc 介绍
由于facebook而火起来的 [jemalloc][] 广为人之，但殊不知，它在malloc界里面很早就出名了。
 [jemalloc][] 的创始人Jason Evans也是在FreeBSD很有名的开发人员。此人就在2006年为提高低性能的
malloc而写的 [jemalloc][]。 [jemalloc][]是从2007年开始以FreeBSD标准引进来的。
软件技术革新很多是FreeBSD发起的。在FreeBSD应用广泛的技术会慢慢导入到linux。

### Jemalloc 的概念

- **Arena：**与其像 malloc 一样集中管理一整块内存，不如将其分成许多个小块来分而治之。此小块便称为arena。让我们想象一下，给几个小朋友一张大图纸，让他们随意地画点。结果可想而知，他们肯定相互顾忌对方而不敢肆意地画(synchronization)，从而影响画图效率。但是如果老师事先在大图纸上划分好每个人的区域，小朋友们就可以又快又准地在各自地领域上画图。
- **Thread cache：**如果是开辟小块内存，为使不参照arena而直接malloc，给各自的线程 thread cache领域。此idea是google的tcmalloc的核心部分，亦在jemalloc中体现。再拿上面的例子，这次给小朋友们除了一张大图纸外，再各自给A4纸一张。这样，小朋友们在不画大面积的点时，只在自己的A4纸上心情地画即可(no arena seeking)。可以在自己手上的纸上画或涂(using thread cache)，完全不用顾忌别人(no synchronization, no locking)，迅速有效地画。

[jemalloc][]的整体结构
![](http://7tsy8h.com1.z0.glb.clouddn.com/jmalloc_1.png)
![](http://7tsy8h.com1.z0.glb.clouddn.com/jmalloc_2.png)

[jemalloc][] 中的分块管理
![](http://7tsy8h.com1.z0.glb.clouddn.com/jmollac_chunk.png)
chunk 将是用一个

## Netty 的实现，源码分析
以下源码分析是基于 netty 4.0.24.Final， 首先来看张 netty 内存的整体图
![](http://7tsy8h.com1.z0.glb.clouddn.com/netty_view.png)
从中可以看出 netty 是将内存分为 arena， chunklist， chunk， subpage， 其中 subpage 又分为 tiny subpage pools 和 small subpage pools， 这些逻辑分类中以 chunk 为中心每个chunk 的默认大小是 16M， chunk 的管理如下图
![](http://7tsy8h.com1.z0.glb.clouddn.com/chunk_mangar.png)
chunk 使用一个完全二叉树来管理，数组的 0 index 没有使用，depth 代表树的深度

 * depth=0        1 node (chunkSize)
 * depth=1        2 nodes (chunkSize/2)
 * ..
 * ..
 * depth=d        2^d nodes (chunkSize/2^d)
 * ..
 * depth=maxOrder 2^maxOrder nodes (chunkSize/2^maxOrder = pageSize)

树的搜索算法，当申请内存是从树的根节点开始，

<pre>
	public static void main(String[] args) throws Exception {
        // Configure SSL.
        final SslContext sslCtx;
        if (SSL) {
            SelfSignedCertificate ssc = new SelfSignedCertificate();
            sslCtx = SslContext.newServerContext(ssc.certificate(), ssc.privateKey());
        } else {
            sslCtx = null;
        }

        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();
        try {
            ServerBootstrap b = new ServerBootstrap();
            b.group(bossGroup, workerGroup)
             .channel(NioServerSocketChannel.class)
             .handler(new LoggingHandler(LogLevel.INFO))
             .childHandler(new FactorialServerInitializer(sslCtx));

            b.bind(PORT).sync().channel().closeFuture().sync();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
</pre>


[-10]:    http://hushi55.github.io/  "-10"
[jemalloc]:   https://www.facebook.com/notes/facebook-engineering/scalable-memory-allocation-using-jemalloc/480222803919  "jemalloc"
