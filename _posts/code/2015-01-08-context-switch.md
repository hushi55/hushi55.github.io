---
layout: post
title: context switch 研究
description: context switch 和 cpu affinity
category: code
tags: [linux, vmstat, context switch]
---
## 问题
不知道是不是大家都有用过 ajax 来过去数据的经验，一般的使用场景就是比如定时刷新看是否有新的数据。那不知道大家是否有运维过这样的应用。我的经验的是当用户量上去以后，系统的 cpu load 会居高不下。我有一次这样的排查经验，系统的 cpu load 非常高，达到 3000%，一直找不到问题所在，经过排查，找出来问题所在是前端 ajax 请求太频繁，设置了 5 秒轮训，导致 linux 服务器大量的 context switch。

## 实验
我们来看下面这段代码：

<pre>
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.LockSupport;

public final class ContextSwitchTest {
	static final int RUNS = 3;
	static final int ITERATES = 1000000;
	static AtomicReference<Thread> turn = new AtomicReference<Thread>();

	static final class WorkerThread extends Thread {
		volatile Thread other;
		volatile int nparks;

		public void run() {
			final AtomicReference<Thread> t = turn;
			final Thread other = this.other;
			if (turn == null || other == null)
				throw new NullPointerException();
			int p = 0;
			for (int i = 0; i < ITERATES; ++i) {
				while (!t.compareAndSet(other, this)) {
					LockSupport.park();
					++p;
				}
				LockSupport.unpark(other);
			}
			LockSupport.unpark(other);
			nparks = p;
			System.out.println("parks: " + p);

		}
	}

	static void test() throws Exception {
		WorkerThread a = new WorkerThread();
		WorkerThread b = new WorkerThread();
		a.other = b;
		b.other = a;
		turn.set(a);
		long startTime = System.nanoTime();
		a.start();
		b.start();
		a.join();
		b.join();
		long endTime = System.nanoTime();
		int parkNum = a.nparks + b.nparks;
		System.out.println("Average time: " + ((endTime - startTime) / parkNum)
				+ "ns");
	}

	public static void main(String[] args) throws Exception {
		for (int i = 0; i < RUNS; i++) {
			test();
		}
	}
}
</pre>

我们先来看看系统的负载

<pre class="nowordwrap">
[root@centos101 ~]# vmstat -w 1
procs -------------------memory------------------ ---swap-- -----io---- --system-- -----cpu-------
 r  b       swpd       free       buff      cache   si   so    bi    bo   in   cs  us sy  id wa st
 0  0     646344    1293172    2660988   44481292    0    0     1    15    0    0   2  0  98  0  0
 0  0     646344    1292920    2660988   44481292    0    0     0    40 1550 1789   0  0 100  0  0
 1  0     646344    1293044    2660988   44481292    0    0     0    44 1456 2060   0  0 100  0  0
 0  0     646344    1293040    2660988   44481292    0    0     0     0 1802 2028   0  0 100  0  0
 3  0     646344    1293224    2660988   44481292    0    0     0     4 1930 2332   1  0  99  0  0
 1  0     646344    1292596    2660988   44481308    0    0     0    76 1766 2681   1  0  99  0  0
 2  0     646344    1292844    2660988   44481308    0    0     0     4 1324 1774   0  0 100  0  0
 1  0     646344    1293620    2660988   44481308    0    0     0    76 1560 2171   0  0  99  0  0
</pre>

现在我们运行上面的程序：

<pre>
[root@centos101 hushi]# java ContextSwitchTest
</pre>

现在的系统负载为：

<pre class="nowordwrap">
[root@centos101 ~]# vmstat -w 1
procs -------------------memory------------------ ---swap-- -----io---- --system-- -----cpu-------
 r  b       swpd       free       buff      cache   si   so    bi    bo   in   cs  us sy  id wa st
 1  0     646316    1432056    2663212   44338940    0    0     1    15    0    0   2  0  98  0  0
 1  0     646316    1431660    2663212   44338940    0    0     0     0 2959 213549   1  2  97  0  0
 2  0     646316    1431668    2663212   44338940    0    0     0     4 2862 211135   1  2  97  0  0
 1  0     646316    1431760    2663212   44338940    0    0     0    16 2931 211029   1  2  97  0  0
 3  0     646316    1431908    2663212   44338940    0    0     0   172 2835 209765   1  2  97  0  0
 2  0     646316    1431908    2663212   44338940    0    0     0     0 2577 241335   1  2  97  0  0
 3  0     646316    1431624    2663212   44338944    0    0     0     4 3114 279214   2  1  97  0  0
 4  0     646316    1431436    2663212   44338944    0    0     0     0 2550 278861   2  1  97  0  0
</pre>

请注意 vmstat 结果中的 cs 列，它的意思就是系统的 context switch 的次数。从两次数据可以看出 context switch 从 2000 左右激增到 200000 左右，增加了 100 倍。
运行后的结果为：

<pre>
[root@centos101 hushi]# java ContextSwitchTest
parks: 960929
parks: 960085
Average time: 8177ns
parks: 937288
parks: 937248
Average time: 8265ns
parks: 875644
parks: 876710
Average time: 7738ns
[root@centos101 hushi]#
</pre>

现在我们绑定这个程序到某一个 cpu 上，看看执行结果会是怎么样的。

<pre>
[root@centos101 hushi]# taskset -c 2 java ContextSwitchTest
parks: 988759
parks: 1000000
Average time: 2634ns
parks: 999242
parks: 998704
Average time: 2593ns
parks: 1000001
parks: 986989
Average time: 2634ns
[root@centos101 hushi]#
</pre>

vmstat 监控到的数据为：

<pre class="nowordwrap">
[root@centos101 ~]# vmstat -w 1
procs -------------------memory------------------ ---swap-- -----io---- --system-- -----cpu-------
 r  b       swpd       free       buff      cache   si   so    bi    bo   in   cs  us sy  id wa st
 1  0     646408    1340460    2663304   44347108    0    0     1    15    0    0   2  0  98  0  0
 1  0     646408    1340728    2663304   44347108    0    0     0     0 2658 393339   1  2  97  0  0
 1  0     646408    1341392    2663304   44347108    0    0     4   124 3042 391449   1  2  97  0  0
 4  0     646408    1339848    2663304   44347108    0    0     0     0 2844 395311   1  2  97  0  0
 2  0     646408    1337472    2663304   44347108    0    0     0     4 2988 392845   1  3  97  0  0
 3  0     646408    1337212    2663304   44347108    0    0     0     4 3096 396890   1  2  97  0  0
 2  0     646408    1337384    2663304   44347108    0    0     0     4 2963 396925   1  3  97  0  0
</pre>

## 什么是 context switch
context 就是我们常说的上线文，switch 必然设计到 2 个 context。过程如下图：
![](http://7tsy8h.com1.z0.glb.clouddn.com/context_switch.png{{ site.watermark }})

那 context 具体是什么什么，其实就是 process control block，如下图：
![](http://7tsy8h.com1.z0.glb.clouddn.com/pcb.png{{ site.watermark }})

具体包括：

- **进程号**
- **进程状态**：new, ready, running, waiting, halted...
- **程序计数器**
- **寄存器**：通用register, stack pointer, PSW等
- **CPU 调度信息**：进程优先级, 在ready queue中的PCB指针，调度参数。
- **内存管理信息**：用了多少CPU time, 使用CPU的Max time, Quantumpage tables, segment tables. Base/limit register, page table(if paging 内存管理)
- **I/O 状态信息**：分配给进程的驱动，打开的文件列表，未完成的I/O request，在I/O queue中的等待编号



## 引起 context switch 的原因

- 当前执行任务的时间片用完之后, 系统CPU正常调度下一个任务
- 当前执行任务碰到IO阻塞, 调度器将挂起此任务, 继续下一任务
- 多个任务抢占锁资源, 当前任务没有抢到,被调度器挂起, 继续下一任务
- 用户代码挂起当前任务, 让出CPU时间
- 硬件中断

## context switch 的影响
上下文切换会带来直接和间接两种因素影响程序性能的消耗

- 直接消耗包括: CPU寄存器需要保存和加载, 系统调度器的代码需要执行, TLB实例需要重新加载, CPU 的pipeline需要刷掉
- 间接消耗指的是多核的cache之间得共享数据, 间接消耗对于程序的影响要看线程工作区操作数据的大小





[-10]:    http://hushi55.github.io/  "-10"
