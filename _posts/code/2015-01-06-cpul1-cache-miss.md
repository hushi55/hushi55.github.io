---
layout: post
title: cpu L1 级 cache miss 研究
description: cpu 内部结构研究
category: code
---
## 引子
<pre>
public class L1CacheMiss1 {
	private static final int RUNS = 10;
	private static final int DIMENSION_1 = 1024 * 1024;
	private static final int DIMENSION_2 = 62;

	private static long[][] longs;

	public static void main(String[] args) throws Exception {
		Thread.sleep(10000);
		longs = new long[DIMENSION_1][];
		for (int i = 0; i < DIMENSION_1; i++) {
			longs[i] = new long[DIMENSION_2];
			for (int j = 0; j < DIMENSION_2; j++) {
				longs[i][j] = 0L;
			}
		}
		System.out.println("starting....");

		final long start = System.nanoTime();
		long sum = 0L;
		for (int r = 0; r < RUNS; r++) {
			for (int j = 0; j < DIMENSION_2; j++) {
				for (int i = 0; i < DIMENSION_1; i++) {
					sum += longs[i][j];
				}
			}

			//for (int i = 0; i < DIMENSION_1; i++) {
			//				for (int j = 0; j < DIMENSION_2; j++) {
			//					sum += longs[i][j];
			//				}
			//			}
		}

			System.out.println(sum);
			System.out.println("duration = " + (System.nanoTime() - start));
	}
}
</pre>

<pre>
public class L1CacheMiss2 {
	private static final int RUNS = 10;
	private static final int DIMENSION_1 = 1024 * 1024;
	private static final int DIMENSION_2 = 62;

	private static long[][] longs;

	public static void main(String[] args) throws Exception {
		Thread.sleep(10000);
		longs = new long[DIMENSION_1][];
		for (int i = 0; i < DIMENSION_1; i++) {
			longs[i] = new long[DIMENSION_2];
			for (int j = 0; j < DIMENSION_2; j++) {
				longs[i][j] = 0L;
			}
		}
		System.out.println("starting....");

		final long start = System.nanoTime();
		long sum = 0L;
		for (int r = 0; r < RUNS; r++) {
			//for (int j = 0; j < DIMENSION_2; j++) {
			//	for (int i = 0; i < DIMENSION_1; i++) {
			//		sum += longs[i][j];
			//	}
			//}

			for (int i = 0; i < DIMENSION_1; i++) {
							for (int j = 0; j < DIMENSION_2; j++) {
								sum += longs[i][j];
							}
						}
		}

			System.out.println(sum);
			System.out.println("duration = " + (System.nanoTime() - start));
	}
}
</pre>

这两个程序比较简单，就是  L1CacheMiss1，L1CacheMiss2 遍历数组的方向不一样。我们可以看看这两个程序各自需要的时间。
L1CacheMiss1:

<pre>
[root@centos101 hushi]# time java L1CacheMiss1
starting....
0
duration = 28704662032

real	0m44.603s
user	0m54.004s
sys		1m28.199s
[root@centos101 hushi]#
</pre>

L1CacheMiss2:

<pre>
[root@centos101 hushi]# time java L1CacheMiss2
starting....
0
duration = 3003702192

real	0m18.819s
user	0m23.566s
sys		1m26.321s
[root@centos101 hushi]#
</pre>

注意这两个值
<pre>
duration = 28704662032
duration = 3003702192
</pre>

第二个访问的消耗的时间将近比第一个少了一个数量级。why ?

## 程序剖析
下面我们来分析造成这两个截然不同的运行时间的原因。

### CPU 的结构
我们先来看看现代 CPU 的一般结构：
![](http://7tsy8h.com1.z0.glb.clouddn.com/cpu_cache.jpg)

从上图可以看出一个 CPU 核心是分别有自己的 L1，L2 级 cache，但是所有的 CPU 核心总用一个 L3 级 cache。那 L1，L2 级 cache 有啥区别呢，请看下图
![](http://7tsy8h.com1.z0.glb.clouddn.com/cpu_l1_l2.png)

L1 级 cache 是分开的，dcache 数据缓存，icache 指令缓存。

从上面我们知道了现代的 CPU 一般都会有一级，二级，三级 cache，那为什么要有这些个 cache，我们知道一般说 cache 其实是为了平衡 read 速度的一个装置，而说 buffer 一般是为了平衡 write 的装置。cpu 这些个 cache 正是填补内存和 cpu 之间读取速度而设计。那我们可以看看到底 CPU 访问各级硬件的时间有多大的差别：
![](http://7tsy8h.com1.z0.glb.clouddn.com/cpu_load_time.png)

## 验证

### perf 介绍
下面我们来验证我们的上面程序为什么会出现运行时间相差一个数量级。
首先我们介绍一个 Linux 下军工级别的监控工具 **perf**。

Perf 是用来进行软件性能分析的工具。通过它，应用程序可以利用 PMU，tracepoint 和内核中的特殊计数器来进行性能统计。它不但可以分析指定应用程序的性能问题 (per thread)，也可以用来分析内核的性能问题，当然也可以同时分析应用代码和内核，从而全面理解应用程序中的性能瓶颈。

最初的时候，它叫做 Performance counter，在 2.6.31 中第一次亮相。此后他成为内核开发最为活跃的一个领域。在 2.6.32 中它正式改名为 Performance Event，因为 perf 已不再仅仅作为 PMU 的抽象，而是能够处理所有的性能相关的事件。使用 perf，您可以分析程序运行期间发生的硬件事件，比如 instructions retired ，processor clock cycles 等；您也可以分析软件事件，比如 Page Fault 和进程切换。

这使得 Perf 拥有了众多的性能分析能力，举例来说，使用 Perf 可以计算每个时钟周期内的指令数，称为 IPC，IPC 偏低表明代码没有很好地利用 CPU。Perf 还可以对程序进行函数级别的采样，从而了解程序的性能瓶颈究竟在哪里等等。Perf 还可以替代 strace，可以添加动态内核 probe 点，还可以做 benchmark 衡量调度器的好坏。。。

我们可以使用

<pre>perf help</pre>

来查看 perf 的使用帮助，perf 的具体使用自行 google, 这里我们列出来这台机器上支持的 event

<pre>
L1-dcache-loads                                [Hardware cache event]
L1-dcache-load-misses                          [Hardware cache event]
L1-dcache-stores                               [Hardware cache event]
L1-dcache-store-misses                         [Hardware cache event]
L1-dcache-prefetches                           [Hardware cache event]
L1-dcache-prefetch-misses                      [Hardware cache event]
L1-icache-loads                                [Hardware cache event]
L1-icache-load-misses                          [Hardware cache event]
L1-icache-prefetches                           [Hardware cache event]
L1-icache-prefetch-misses                      [Hardware cache event]
</pre>

这里我只列出来了跟 L1 级 cache 相关 event，其中 dcache 代表 data cache 数据缓存，icache 代表 instruction cache 指令缓存。

### perf L1-dcache-load-misses 统计验证

<pre>
[root@centos101 hushi]# perf stat -e L1-dcache-load-misses java L1CacheMiss1
starting....
0
duration = 27936761365

 Performance counter stats for 'java L1CacheMiss1':

     1,914,529,933 L1-dcache-misses


      43.200703471 seconds time elapsed

[root@centos101 hushi]#
</pre>

<pre>
[root@centos101 hushi]# perf stat -e L1-dcache-load-misses java L1CacheMiss2
starting....
0
duration = 3142251198

 Performance counter stats for 'java L1CacheMiss2':

       520,161,728 L1-dcache-misses


      20.323997237 seconds time elapsed

[root@centos101 hushi]#
</pre>

从 L1-dcache-misses 的次数可以看出确实 L1CacheMiss1 要高出不少。

## 参考
https://www.ibm.com/developerworks/cn/linux/l-cn-perf1/

[-10]:    http://hushi55.github.io/  "-10"
