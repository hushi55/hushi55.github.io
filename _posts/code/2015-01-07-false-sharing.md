---
layout: post
title: false sharing 研究
description: cpu cacheline 研究
category: code
tags: [java, linux, perf, falsesharing, cpu]
---
## 引子
我们还是从实验开始，看下面这两端段程序：

<pre>
public final class FalseSharing implements Runnable {
	public static int NUM_THREADS = 4; // change
	public final static long ITERATIONS = 500L * 1000L * 1000L;
	private final int arrayIndex;
	private static VolatileLong[] longs;

	public FalseSharing(final int arrayIndex) {
		this.arrayIndex = arrayIndex;
	}

	public static void main(final String[] args) throws Exception {
		Thread.sleep(10000);
		System.out.println("starting....");
		if (args.length == 1) {
			NUM_THREADS = Integer.parseInt(args[0]);
		}

		longs = new VolatileLong[NUM_THREADS];
		for (int i = 0; i < longs.length; i++) {
			longs[i] = new VolatileLong();
		}
		final long start = System.nanoTime();
		runTest();
		System.out.println("duration = " + (System.nanoTime() - start));
	}

	private static void runTest() throws InterruptedException {
		Thread[] threads = new Thread[NUM_THREADS];
		for (int i = 0; i < threads.length; i++) {
			threads[i] = new Thread(new FalseSharing(i));
		}
		for (Thread t : threads) {
			t.start();
		}
		for (Thread t : threads) {
			t.join();
		}
	}

	public void run() {
		long i = ITERATIONS + 1;
		while (0 != --i) {
			longs[arrayIndex].value = i;
		}
	}

	public final static class VolatileLong {
		public volatile long value = 0L;
//		public long p1, p2, p3, p4, p5, p6; //
//
//				public long sum() {
//					return p1 + p2 + p3 + p4 + p5 + p6;
//				}
	}
}
</pre>
<pre>
public final class NoFalseSharing implements Runnable {
	public static int NUM_THREADS = 4; // change
	public final static long ITERATIONS = 500L * 1000L * 1000L;
	private final int arrayIndex;
	private static VolatileLong[] longs;

	public NoFalseSharing(final int arrayIndex) {
		this.arrayIndex = arrayIndex;
	}

	public static void main(final String[] args) throws Exception {
		Thread.sleep(10000);
		System.out.println("starting....");
		if (args.length == 1) {
			NUM_THREADS = Integer.parseInt(args[0]);
		}

		longs = new VolatileLong[NUM_THREADS];
		for (int i = 0; i < longs.length; i++) {
			longs[i] = new VolatileLong();
		}
		final long start = System.nanoTime();
		runTest();
		System.out.println("duration = " + (System.nanoTime() - start));
	}

	private static void runTest() throws InterruptedException {
		Thread[] threads = new Thread[NUM_THREADS];
		for (int i = 0; i < threads.length; i++) {
			threads[i] = new Thread(new NoFalseSharing(i));
		}
		for (Thread t : threads) {
			t.start();
		}
		for (Thread t : threads) {
			t.join();
		}
	}

	public void run() {
		long i = ITERATIONS + 1;
		while (0 != --i) {
			longs[arrayIndex].value = i;
		}
	}

	public final static class VolatileLong {
		public volatile long value = 0L;
		public long p1, p2, p3, p4, p5, p6;
		public long sum() {
			return p1 + p2 + p3 + p4 + p5 + p6;
		}
	}
}
</pre>

这两段程序只是 NoFalseSharing 填充了 7 个 long 型的数据，其他没有什么不同。
我们来看看这俩段程序运行的时间

<pre>
[root@centos101 hushi]# time java FalseSharing
starting....
duration = 34082260485

real	0m44.266s
user	2m12.387s
sys		0m0.052s
[root@centos101 hushi]# time java NoFalseSharing
starting....
duration = 6296462316

real	0m16.400s
user	0m25.026s
sys		0m0.039s
[root@centos101 hushi]#
</pre>

很明显 NoFalseSharing 的运行时间比  FalseSharing 小了将近 6 倍。why？

## 问题分析
从上一篇文章我们知道现代多核 CPU 是存在多级 cache 的，那么存在两个问题

- cpu 如何组织和管理这些缓存的？
- cpu 是如何确保这么多 cache 中数据的一致性的？

对于第一个问题，我简单的描述下，cpu 对于 cache 的管理不可能是一个 byte 一个 byte 的管理的，因为这样效率就太低了。cpu 将多个 byte 作为一个单员来管理，这个单员就叫做  cacheline，我们可以在 linux 下通过如下命令来查看一个 cacheline 的大小

<pre>
[root@centos101 ~]# cat /sys/devices/system/cpu/cpu0/cache/index0/coherency_line_size
64
[root@centos101 ~]#
</pre>

可以看到一个 cacheline 的大小是 64 个字节。

对于第二个问题，CPU 各个核之间的通过一致性协议来访问 cache 中的数据，其中 MESI 协议是使用的最多的一种，如图：

![](http://7tsy8h.com1.z0.glb.clouddn.com/@/cpu/cpu_mesi.png{{ site.watermark }})

M,E,S和I代表使用MESI协议时缓存行所处的四个状态：

- M(修改, Modified)：本地处理器已经修改缓存行，即是脏行，它的内容与内存中的内容不一样. 并且此cache只有本地一个拷贝(专有)。
- E(专有, Exclusive)：缓存行内容和内存中的一样，而且其它处理器都没有这行数据 。
- S(共享, Shared)：缓存行内容和内存中的一样,有可能其它处理器也存在此缓存行的拷贝
- I(无效, Invalid)：缓存行失效，不能使用 。

通过上面的介绍我们知道了 CPU 内部是如何组织和管理 cache 的，一个 cacheline 有 64 字节之多，那么当有两个线程都修改了一个 cacheline 中的两个不同的数据，根据 MESI 一致性协议，这个 cacheline 应该是失效的，应该和主存同步数据，这个如图所示：

![](http://7tsy8h.com1.z0.glb.clouddn.com/@/cpu/false_sharing1.jpg{{ site.watermark }})

那么这造成 L1 级 cache 不断的失效。

## 验证问题
由于 NoFalseSharing 填充了 7 个 long 型数据，正好能保证 value 属性在一个 cacheline中，效果如图所示

![](http://7tsy8h.com1.z0.glb.clouddn.com/@/cpu/false_sharing2.png{{ site.watermark }})

所以猜测应该是 NoFalseSharing L1 级 cache 的  miss 事件应该更少。既然是 L1 级 cache 会失效，那么我们来看看实验的结果：

<pre>
[root@centos101 hushi]# perf stat -e L1-dcache-load-misses java FalseSharing
starting....
duration = 35808081578

 Performance counter stats for 'java FalseSharing':

       158,654,180 L1-dcache-misses


      45.920416219 seconds time elapsed

[root@centos101 hushi]# perf stat -e L1-dcache-load-misses java NoFalseSharing
starting....
duration = 6262425464

 Performance counter stats for 'java NoFalseSharing':

         3,403,174 L1-dcache-misses


      16.375648903 seconds time elapsed

[root@centos101 hushi]#
</pre>

从上面的实验的数据中可以看到，确实是 NoFalseSharing 更少，大概相差 5 倍左右，这根实验的运行时间相差大概一致。

## 改进
我们知道了 false sharing 的产生的原因，由于 java 语言的特殊性，java 对象在内存中的布局，对象是要占一定的内存的，上面 NoFalseSharing 的填充方法有待改进。

<pre>
import java.lang.reflect.Field;
import java.security.AccessController;
import java.security.PrivilegedExceptionAction;

import sun.misc.Unsafe;

public final class SuperNoFalseSharing implements Runnable {
	public static int NUM_THREADS = 4; // change
	public final static long ITERATIONS = 500L * 1000L * 1000L;
	private final int arrayIndex;
	private static VolatileLong[] longs;

	public SuperNoFalseSharing(final int arrayIndex) {
		this.arrayIndex = arrayIndex;
	}

	public static void main(final String[] args) throws Exception {
		Thread.sleep(10000);
		System.out.println("starting....");
		if (args.length == 1) {
			NUM_THREADS = Integer.parseInt(args[0]);
		}

		longs = new VolatileLong[NUM_THREADS];
		for (int i = 0; i < longs.length; i++) {
			longs[i] = new VolatileLong();
		}
		final long start = System.nanoTime();
		runTest();
		System.out.println("duration = " + (System.nanoTime() - start));
	}

	private static void runTest() throws InterruptedException {
		Thread[] threads = new Thread[NUM_THREADS];
		for (int i = 0; i < threads.length; i++) {
			threads[i] = new Thread(new SuperNoFalseSharing(i));
		}
		for (Thread t : threads) {
			t.start();
		}
		for (Thread t : threads) {
			t.join();
		}
	}

	public void run() {
		long i = ITERATIONS + 1;
		while (0 != --i) {
			longs[arrayIndex].set(i);
		}
	}

	public final static class VolatileLong {

		static final long INITIAL_VALUE = -1L;
	    private static final Unsafe UNSAFE;
	    private static final long VALUE_OFFSET;

	    static
	    {
	        UNSAFE = getUnsafe();
	        final int base = UNSAFE.arrayBaseOffset(long[].class);
	        final int scale = UNSAFE.arrayIndexScale(long[].class);
	        VALUE_OFFSET = base + (scale * 7);
	    }

	    private final long[] paddedValue = new long[15];

	    /**
	     * Create a sequence initialised to -1.
	     */
	    public VolatileLong()
	    {
	        this(INITIAL_VALUE);
	    }

	    private static Unsafe getUnsafe() {

	    	final Unsafe THE_UNSAFE;

	        {
	            try
	            {
	                final PrivilegedExceptionAction<Unsafe> action = new PrivilegedExceptionAction<Unsafe>()
	                {
	                    public Unsafe run() throws Exception
	                    {
	                        Field theUnsafe = Unsafe.class.getDeclaredField("theUnsafe");
	                        theUnsafe.setAccessible(true);
	                        return (Unsafe) theUnsafe.get(null);
	                    }
	                };

	                THE_UNSAFE = AccessController.doPrivileged(action);
	            }
	            catch (Exception e)
	            {
	                throw new RuntimeException("Unable to load unsafe", e);
	            }
	        }
			return THE_UNSAFE;

		}

		/**
	     * Create a sequence with a specified initial value.
	     *
	     * @param initialValue The initial value for this sequence.
	     */
	    public VolatileLong(final long initialValue)
	    {
	        UNSAFE.putOrderedLong(paddedValue, VALUE_OFFSET, initialValue);
	    }

	    /**
	     * Perform a volatile read of this sequence's value.
	     *
	     * @return The current value of the sequence.
	     */
	    public long get()
	    {
	        return UNSAFE.getLongVolatile(paddedValue, VALUE_OFFSET);
	    }

	    /**
	     * Perform an ordered write of this sequence.  The intent is
	     * a Store/Store barrier between this write and any previous
	     * store.
	     *
	     * @param value The new value for the sequence.
	     */
	    public void set(final long value)
	    {
	        UNSAFE.putOrderedLong(paddedValue, VALUE_OFFSET, value);
	    }

	    /**
	     * Performs a volatile write of this sequence.  The intent is
	     * a Store/Store barrier between this write and any previous
	     * write and a Store/Load barrier between this write and any
	     * subsequent volatile read.
	     *
	     * @param value The new value for the sequence.
	     */
	    public void setVolatile(final long value)
	    {
	        UNSAFE.putLongVolatile(paddedValue, VALUE_OFFSET, value);
	    }

	    /**
	     * Perform a compare and set operation on the sequence.
	     *
	     * @param expectedValue The expected current value.
	     * @param newValue The value to update to.
	     * @return true if the operation succeeds, false otherwise.
	     */
	    public boolean compareAndSet(final long expectedValue, final long newValue)
	    {
	        return UNSAFE.compareAndSwapLong(paddedValue, VALUE_OFFSET, expectedValue, newValue);
	    }

	    /**
	     * Atomically increment the sequence by one.
	     *
	     * @return The value after the increment
	     */
	    public long incrementAndGet() {
	        return addAndGet(1L);
	    }

	    /**
	     * Atomically add the supplied value.
	     *
	     * @param increment The value to add to the sequence.
	     * @return The value after the increment.
	     */
	    public long addAndGet(final long increment) {
	        long currentValue;
	        long newValue;

	        do
	        {
	            currentValue = get();
	            newValue = currentValue + increment;
	        }
	        while (!compareAndSet(currentValue, newValue));

	        return newValue;
	    }

	    public String toString() {
	        return Long.toString(get());
	    }
	}


}
</pre>

将 value 存放在 long 型数组中，左右两边各有 7 个元素，这样保证一定加载到一个 cacheline 中。这个技巧就是 [disruptor](https://github.com/LMAX-Exchange/disruptor/wiki/Introduction) 无锁队列使用的技巧。


[-10]:    http://hushi55.github.io/  "-10"
