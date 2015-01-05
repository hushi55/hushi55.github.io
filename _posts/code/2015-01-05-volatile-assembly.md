---
layout: post
title: Java volatile 汇编代码研究
description: 通过 volatile 的汇编代码研究 JVM 内存模型
category: code
---
我们有下面这段程序代码：

<pre>
package edu.hushi.jvm;

/**
 *
 * @author -10
 *
 */
public class VisibilityTest extends Thread {

    private boolean stop;

    public void run() {
        int i = 0;
        while(!stop) {
            i++;
        }
        System.out.println("finish loop,i=" + i);
    }

    public void stopIt() {
        stop = true;
    }

    public boolean getStop(){
        return stop;
    }
    public static void main(String[] args) throws Exception {
        VisibilityTest v = new VisibilityTest();
        v.start();

        Thread.sleep(1000);
        v.stopIt();
        Thread.sleep(2000);
        System.out.println("finish main");
        System.out.println(v.getStop());
    }

}
</pre>

程序比较简单，在主线程中启动一个线程，这个线程不停的对局部变量做自增操作，主线程休眠 1 秒中后改变启动线程的循环控制变量，想让它停止循环。这个程序在 client 模式下是能停止线程做自增操作的，但是在 server 模式先将是无限循环。若是改成

<pre>
private volatile boolean stop;
</pre>

用 volatile 修饰 stop 变量，将不会出现死循环。我们知道 volatile 在 JVM 内存模型中是保证了修饰变量的可见性，这个不是我们今天讨论的重点，我们今天想看看在 volatile 修饰下和不修饰代码编译成的汇编代码的区别，以便我们学习 JVM 的内存模型。

首先我们介绍一个工具，HSDIS是由[Project Kenai](http://kenai.com/projects/base-hsdis)提供并得到Sun官方推荐的HotSpot VM JIT编译代码的反汇编插件，作用是让HotSpot的-XX:+PrintAssembly指令调用它来把动态生成的本地代码还原为汇编代码输出，同时还生成了大量非常有价值的注释，这样我们就可以通过输出的代码来分析问题。读者可以根据自己的操作系统和CPU类型从Kenai的网站上下载编译好的插件，直接放到JDK_HOME/jre/bin/client和JDK_HOME/jre/bin/server目录中即可。如果没有找到所需操作系统（譬如Windows的就没有）的成品，那就得自己拿源码编译一下，或者去[HLLVM圈子](http://hllvm.group.iteye.com/)中下载也可以，[这里](http://fcml-lib.com/download.html)还有一个。

<pre>
-server
-XX:+UnlockDiagnosticVMOptions
-XX:+PrintAssembly -Xcomp
-XX:CompileCommand=dontinline,*VisibilityTest.run
-XX:CompileCommand=compileonly,*VisibilityTest.run
edu.hushi.jvm.VisibilityTest
</pre>


[-10]:    http://hushi55.github.io/  "-10"
