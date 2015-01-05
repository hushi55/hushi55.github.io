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
-Xcomp
-XX:+UnlockDiagnosticVMOptions
-XX:CompileCommand=dontinline,*VisibilityTest.run
-XX:CompileCommand=compileonly,*VisibilityTest.run
-XX:+PrintAssembly
</pre>

其中

* -Xcomp 参数-Xcomp是让虚拟机以编译模式执行代码，这样代码可以偷懒，不需要执行足够次数来预热都能触发JIT编译。
* -XX:CompileCommand=dontinline,*VisibilityTest.run 这个表示不要把 run 方法给内联了，这是解决内联问题。
* -XX:CompileCommand=compileonly,*VisibilityTest.run 这个表示只编译 run 方法，这样的话只会输出sum方法的ASM码。
* -XX:+UnlockDiagnosticVMOptions 这个参数是和 -XX:+PrintAssembly 一起才能生效答应汇编代码

以下是**没有** volatile 修饰的 assembly 代码

<pre>
Java HotSpot(TM) 64-Bit Server VM warning: PrintAssembly is enabled; turning on DebugNonSafepoints to gain additional output
CompilerOracle: dontinline *VisibilityTest.run
CompilerOracle: compileonly *VisibilityTest.run
Loaded disassembler from D:\dev\java\jdk1.7.0_71\jre\bin\server\hsdis-amd64.dll
Decoding compiled method 0x00000000025b4b90:
Code:
Argument 0 is unknown.RIP: 0x25b4cc0 Code size: 0x00000078
[Disassembling for mach='amd64']
[Entry Point]
[Constants]
  # {method} 'run' '()V' in 'edu/hushi/test/VisibilityTest'
  #           [sp+0x20]  (sp of caller)
  0x00000000025b4cc0: mov     r10d,dword ptr [rdx+8h]
  0x00000000025b4cc4: shl     r10,3h
  0x00000000025b4cc8: cmp     rax,r10
  0x00000000025b4ccb: jne     2587a60h          ;   {runtime_call}
  0x00000000025b4cd1: nop
  0x00000000025b4cd4: nop     dword ptr [rax+rax+0h]
  0x00000000025b4cdc: nop
[Verified Entry Point]
  0x00000000025b4ce0: mov     dword ptr [rsp+0ffffffffffffa000h],eax
  0x00000000025b4ce7: push    rbp
  0x00000000025b4ce8: sub     rsp,10h           ;*synchronization entry
                                                ; - edu.hushi.test.VisibilityTest::run@-1 (line 13)
  0x00000000025b4cec: mov     r10,rdx
  0x00000000025b4cef: movzx   r8d,byte ptr [rdx+68h]  ;*getfield stop
                                                ; - edu.hushi.test.VisibilityTest::run@9 (line 14)
  0x00000000025b4cf4: test    r8d,r8d
  0x00000000025b4cf7: jne     25b4d0ah          ;*ifeq
                                                ; - edu.hushi.test.VisibilityTest::run@12 (line 14)
  0x00000000025b4cf9: mov     r11d,1h           ; OopMap{r10=Oop off=63}
                                                ;*ifeq
                                                ; - edu.hushi.test.VisibilityTest::run@12 (line 14)
  0x00000000025b4cff: test    dword ptr [100000h],eax  ;*ifeq
                                                ; - edu.hushi.test.VisibilityTest::run@12 (line 14)
                                                ;   {poll}
  0x00000000025b4d05: inc     r11d              ;*iinc
                                                ; - edu.hushi.test.VisibilityTest::run@5 (line 15)
  0x00000000025b4d08: jmp     25b4cffh
  0x00000000025b4d0a: mov     edx,14h
  0x00000000025b4d0f: mov     rbp,r10
  0x00000000025b4d12: nop
  0x00000000025b4d13: call    25874e0h          ; OopMap{rbp=Oop off=88}
                                                ;*getstatic out
                                                ; - edu.hushi.test.VisibilityTest::run@15 (line 17)
                                                ;   {runtime_call}
  0x00000000025b4d18: int3                      ;*iinc
                                                ; - edu.hushi.test.VisibilityTest::run@5 (line 15)
  0x00000000025b4d19: int3
  0x00000000025b4d1a: hlt
  0x00000000025b4d1b: hlt
  0x00000000025b4d1c: hlt
  0x00000000025b4d1d: hlt
  0x00000000025b4d1e: hlt
  0x00000000025b4d1f: hlt
[Exception Handler]
[Stub Code]
  0x00000000025b4d20: jmp     2597220h          ;   {no_reloc}
[Deopt Handler Code]
  0x00000000025b4d25: call    25b4d2ah
  0x00000000025b4d2a: sub     qword ptr [rsp],5h
  0x00000000025b4d2f: jmp     2589000h          ;   {runtime_call}
  0x00000000025b4d34: hlt
  0x00000000025b4d35: hlt
  0x00000000025b4d36: hlt
  0x00000000025b4d37: hlt
</pre>

以下是**有** volatile 修饰的 assembly 代码

<pre>
Java HotSpot(TM) 64-Bit Server VM warning: PrintAssembly is enabled; turning on DebugNonSafepoints to gain additional output
CompilerOracle: dontinline *VisibilityTest.run
CompilerOracle: compileonly *VisibilityTest.run
Loaded disassembler from D:\dev\java\jdk1.7.0_71\jre\bin\server\hsdis-amd64.dll
Decoding compiled method 0x00000000025e5710:
Code:
Argument 0 is unknown.RIP: 0x25e5840 Code size: 0x00000098
[Disassembling for mach='amd64']
[Entry Point]
[Constants]
  # {method} 'run' '()V' in 'edu/hushi/test/VisibilityTest'
  #           [sp+0x20]  (sp of caller)
  0x00000000025e5840: mov     r10d,dword ptr [rdx+8h]
  0x00000000025e5844: shl     r10,3h
  0x00000000025e5848: cmp     rax,r10
  0x00000000025e584b: jne     25b7a60h          ;   {runtime_call}
  0x00000000025e5851: nop
  0x00000000025e5854: nop     dword ptr [rax+rax+0h]
  0x00000000025e585c: nop
[Verified Entry Point]
  0x00000000025e5860: mov     dword ptr [rsp+0ffffffffffffa000h],eax
  0x00000000025e5867: push    rbp
  0x00000000025e5868: sub     rsp,10h           ;*synchronization entry
                                                ; - edu.hushi.test.VisibilityTest::run@-1 (line 13)
  0x00000000025e586c: movzx   r10d,byte ptr [rdx+68h]  ;*getfield stop
                                                ; - edu.hushi.test.VisibilityTest::run@9 (line 14)
  0x00000000025e5871: xor     r11d,r11d
  0x00000000025e5874: test    r10d,r10d
  0x00000000025e5877: jne     25e5893h          ;*ifeq
                                                ; - edu.hushi.test.VisibilityTest::run@12 (line 14)
  0x00000000025e5879: nop     dword ptr [rax+0h]  ;*iinc
                                                ; - edu.hushi.test.VisibilityTest::run@5 (line 15)
  0x00000000025e5880: movzx   r8d,byte ptr [rdx+68h]  ;*getfield stop
                                                ; - edu.hushi.test.VisibilityTest::run@9 (line 14)
  0x00000000025e5885: inc     r11d              ; OopMap{rdx=Oop off=72}
                                                ;*ifeq
                                                ; - edu.hushi.test.VisibilityTest::run@12 (line 14)
  0x00000000025e5888: test    dword ptr [210000h],eax  ;   {poll}
  0x00000000025e588e: test    r8d,r8d
  0x00000000025e5891: je      25e5880h          ;*getstatic out
                                                ; - edu.hushi.test.VisibilityTest::run@15 (line 17)
  0x00000000025e5893: mov     edx,14h
  0x00000000025e5898: mov     ebp,r11d
  0x00000000025e589b: call    25b74e0h          ; OopMap{off=96}
                                                ;*getstatic out
                                                ; - edu.hushi.test.VisibilityTest::run@15 (line 17)
                                                ;   {runtime_call}
  0x00000000025e58a0: int3                      ;*getstatic out
                                                ; - edu.hushi.test.VisibilityTest::run@15 (line 17)
  0x00000000025e58a1: hlt
  0x00000000025e58a2: hlt
  0x00000000025e58a3: hlt
  0x00000000025e58a4: hlt
  0x00000000025e58a5: hlt
  0x00000000025e58a6: hlt
  0x00000000025e58a7: hlt
  0x00000000025e58a8: hlt
  0x00000000025e58a9: hlt
  0x00000000025e58aa: hlt
  0x00000000025e58ab: hlt
  0x00000000025e58ac: hlt
  0x00000000025e58ad: hlt
  0x00000000025e58ae: hlt
  0x00000000025e58af: hlt
  0x00000000025e58b0: hlt
  0x00000000025e58b1: hlt
  0x00000000025e58b2: hlt
  0x00000000025e58b3: hlt
  0x00000000025e58b4: hlt
  0x00000000025e58b5: hlt
  0x00000000025e58b6: hlt
  0x00000000025e58b7: hlt
  0x00000000025e58b8: hlt
  0x00000000025e58b9: hlt
  0x00000000025e58ba: hlt
  0x00000000025e58bb: hlt
  0x00000000025e58bc: hlt
  0x00000000025e58bd: hlt
  0x00000000025e58be: hlt
  0x00000000025e58bf: hlt
[Exception Handler]
[Stub Code]
  0x00000000025e58c0: jmp     25e25e0h          ;   {no_reloc}
[Deopt Handler Code]
  0x00000000025e58c5: call    25e58cah
  0x00000000025e58ca: sub     qword ptr [rsp],5h
  0x00000000025e58cf: jmp     25b9000h          ;   {runtime_call}
  0x00000000025e58d4: hlt
  0x00000000025e58d5: hlt
  0x00000000025e58d6: hlt
  0x00000000025e58d7: hlt
finish loop,i=1761121489
finish main
true
</pre>

## 参考

- [http://docs.oracle.com/javase/8/docs/technotes/tools/unix/java.html](http://docs.oracle.com/javase/8/docs/technotes/tools/unix/java.html#BABDDFII)
- [http://www.infoq.com/cn/articles/ftf-java-volatile](http://www.infoq.com/cn/articles/ftf-java-volatile)
- [http://www.infoq.com/cn/articles/zzm-java-hsdis-jvm](http://www.infoq.com/cn/articles/zzm-java-hsdis-jvm)
- [http://www.infoq.com/cn/articles/memory_barriers_jvm_concurrency](http://www.infoq.com/cn/articles/memory_barriers_jvm_concurrency)


[-10]:    http://hushi55.github.io/  "-10"
