---
layout: post
title: Golang scheduler
description: Golang 并发调度：G, P, M 模型
category: code
tags: [linux, Golang]
---
## 介绍 Golang 的并发模型
我们都知道 Golang 是在语言级别支持并发的，通过关键字 go 就可以创建一个并发的携程。这篇 blog 主要是视图讲解清楚使用 go 关键字时，
都发生了什么。

Golang 处理这里 go 关键字的内部主要使用到了四个相关的概念：

- 先是 Processor（简称 P），它的作用类似 CPU core，用来控制可同时并发执行的任务数量。
每个工作线程都必须绑定一个有效 P 才能获取并执行任务，否则只能休眠，直到有空闲 P 时才被唤醒。
P 还为线程提供执行所需资源，例如为对象分配内存的 cache。线程独享所绑定的 P 资源，可在无锁状态下执行空间管理和调度并发任务操作。 
P 结构如下所示：
![](/images/blog/golang/Golang_P_layout.png) 
- 所有并发任务，包括 main.main 都以 goroutine（简称 G）方式运行。需要指出，G 并非执行体，它仅仅保存任务状态，
为任务执行提供所需栈内存空间。G 任务创建后被放置在 P 本地队列或全局队列，等待工作线程获取执行。G 结构如下所示：
![](/images/blog/golang/Golang_G_layout.png)
- 实际执行体是系统线程（简称 M），它和 P 构成组合体，以调度循环方式不停执行 G 并发任务。
M 通过修改寄存器，将执行栈指向 G 自带栈内存，并在此空间内分配堆栈帧，执行任务函数。当需要调度切换时，
只要将相关寄存器值保存回 G 空间即可维持状态，任何 M 都可此恢复执行。
线程仅负责执行，不再持有状态，这是并发任务跨线程调度，实 现多路复用的根本所在。M 结构如下所示：
![](/images/blog/golang/Golang_M_layout.png)
- sched 就是调度器，它维护有存储 M, P, 和 G 的队列以及调度器的一些状态信息等。schedt 结构如下所示：
![](/images/blog/golang/Golang_schedt_layout.png)


我们来看一张图，就可以清楚的知道 M, P, G 的关系：

![](/images/blog/golang/golang_M_P_G_car.jpeg)

地鼠(gopher)用小车运着一堆待加工的砖。M 就可以看作图中的地鼠，P就是小车，G就是小车里装的砖，一图胜千言。

## go 关键字详解
上面我们清楚了 Golang 内部是怎么处理 M, P, G 的，这小节我们来看看 G 是怎么来，也就是使用 go 关键字后都发生了什么，
首相我们会使用一个简单的 go 使用的例子：

<pre class="nowordwrap">
// test.go  

package main 

import () 

func add(x, y int) int { 
  z := x + y   
  return z 
} 

func main() { 
  x := 0x100 
  y := 0x200

  go add(x, y)

} 
</pre>

为了演示我们使用了一个非常简单的例子，现在我们来看看编译的代码是什么情况：


<pre class="nowordwrap">
$ go build -o test test.go 

$ go tool objdump -s "main\.main" test 

TEXT main.main(SB) test.go 

    test.go:10   SUBQ $0x28, SP 
    test.go:11   MOVQ $0x100, CX
    test.go:12   MOVQ $0x200, AX 
    test.go:13   MOVQ CX, 0x10(SP)          //  x 入栈 
    test.go:13   MOVQ AX, 0x18(SP)          //  y 入栈
    test.go:13   MOVL $0x18, 0(SP)          //  参数长度入栈
    test.go:13   LEAQ 0x879ff(IP), AX       //  add 地址放入 AX 
    test.go:13   MOVQ AX, 0x8(SP)           //  地址如栈
    test.go:13   CALL runtime.newproc(SB) 
    test.go:14   ADDQ $0x28, SP 
    test.go:14   RET 
</pre>

中上面的汇编可以看到，会调用 runtime.newproc，函数如下：

<pre class="nowordwrap">
// runtime/proc1.go

func newproc(siz int32, fn *funcval) {
	argp := add(unsafe.Pointer(&fn), ptrSize)
	pc := getcallerpc(unsafe.Pointer(&siz))
	systemstack(func() {
		newproc1(fn, (*uint8)(argp), siz, 0, pc)
	})
}
</pre>

我们从汇编代码可以看到入栈了 4 个参数，但是 newproc 函数只有 2 个参数，这是因为使用的了 fn *funcval 将后面的参数都捏一起，组成一个参数。
我们讲接下上面代码的意思，可以对照下面的内存布局图：

![](/images/blog/golang/Golang_go_memory_layout.png)

- 第四行：是通过 fn 的地址，增加一个指针的大小，即跳过 add 函数的地址，是所有实参数的首地址。
- 第五行：使用 siz 的地址获取调用的 PC/IP 寄存器的值，因为 call 指令会将这个寄存的值压入栈中。

这样我们就清楚了 go 关键字后，具体在内存中发生了什么。

## 调度算法介绍
调度核心的算法可以用下图来说明：

![](/images/blog/golang/gopher_M_P_G_Sched_bz.jpg)

- 地鼠(M)试图从自己的小车(P)取出一块砖(G)，当然结果可能失败，也就是这个地鼠的小车已经空了，没有砖了。
- 如果地鼠自己的小车中没有砖，那也不能闲着不干活是吧，所以地鼠就会试图跑去工场仓库取一块砖来处理；
工场仓库也可能没砖啊，出现这种情况的时候，这个地鼠也没有偷懒停下干活，而是悄悄跑出去，随机盯上一个小伙伴(地鼠)，
然后从它的车里试图偷一半砖到自己车里。如果多次尝试偷砖都失败了，那说明实在没有砖可搬了，
这个时候地鼠就会把小车还回停车场，然后睡觉休息了。如果地鼠睡觉了，下面的过程当然都停止了，地鼠睡觉也就是线程sleep了。
- 到这个过程的时候，可怜的地鼠发现自己小车里有好多砖啊，自己根本处理不过来；再回头一看停车场居然有闲置的小车，
立马跑到宿舍一看，你妹，居然还有小伙伴在睡觉，直接给屁股一脚，`你妹，居然还在睡觉，老子都快累死了，赶紧起来干活，分担点工作。`
小伙伴醒了，拿上自己的小车，乖乖干活去了。有时候，可怜的地鼠跑到宿舍却发现没有在睡觉的小伙伴，于是会很失望，
最后只好向工场老板说 - `停车场还有闲置的车啊，我快干不动了，赶紧从别的工场借个地鼠来帮忙吧。`最后工场老板就搞来一个新的地鼠干活了。
- 地鼠拿着砖放入火种欢快的烧练起来。


## 参考

- [goroutine与调度器](http://skoo.me/go/2013/11/29/golang-schedule/)
- [Golang 1.5 源码剖析](http://pan.baidu.com/s/1hrmVz7I)


[-10]:    http://hushi55.github.io/  "-10"
