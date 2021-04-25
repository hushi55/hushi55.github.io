---
layout: post
title: Java volatile 汇编代码研究
description: 通过 volatile 的汇编代码研究 JVM 内存模型
category: code
tags: [java, jvm, assmebly]
---
## 一个程序
我们有下面这段程序代码：

```java
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
```

程序比较简单，在主线程中启动一个线程，这个线程不停的对局部变量做自增操作，主线程休眠 1 秒中后改变启动线程的循环控制变量，想让它停止循环。这个程序在 client 模式下是能停止线程做自增操作的，**但是在 server 模式先将是无限循环**。若是改成

<pre>
private volatile boolean stop;
</pre>

用 volatile 修饰 stop 变量，将不会出现死循环。我们知道 volatile 在 JVM 内存模型中是保证修饰变量的可见性，这个不是我们今天讨论的重点，我们今天想看看在 volatile 修饰下和不修饰代码编译成的汇编代码的区别，以便我们学习 JVM 的内存模型。

## HSDIS 介绍
首先我们介绍一个工具，HSDIS是由[Project Kenai](http://kenai.com/projects/base-hsdis)提供并得到Sun官方推荐的HotSpot VM JIT编译代码的反汇编插件，作用是让HotSpot的-XX:+PrintAssembly指令调用它来把动态生成的本地代码还原为汇编代码输出，同时还生成了大量非常有价值的注释，这样我们就可以通过输出的代码来分析问题。读者可以根据自己的操作系统和CPU类型从Kenai的网站上下载编译好的插件，直接放到JDK_HOME/jre/bin/client和JDK_HOME/jre/bin/server目录中即可。如果没有找到所需操作系统（譬如Windows的就没有）的成品，那就得自己拿源码编译一下，或者去[HLLVM圈子](http://hllvm.group.iteye.com/)中下载也可以，[这里](http://fcml-lib.com/download.html)也有 win32 和 win64 编译好的。

```shell
-server
-Xcomp
-XX:+UnlockDiagnosticVMOptions
-XX:CompileCommand=dontinline,*VisibilityTest.run
-XX:CompileCommand=compileonly,*VisibilityTest.run
-XX:+PrintAssembly
```

其中

* -Xcomp 参数-Xcomp是让虚拟机以编译模式执行代码，这样代码可以偷懒，不需要执行足够次数来预热都能触发JIT编译。
* -XX:CompileCommand=dontinline,*VisibilityTest.run 这个表示不要把 run 方法给内联了，这是解决内联问题。
* -XX:CompileCommand=compileonly,*VisibilityTest.run 这个表示只编译 run 方法，这样的话只会输出sum方法的ASM码。
* -XX:+UnlockDiagnosticVMOptions 这个参数是和 -XX:+PrintAssembly 一起才能生效答应汇编代码

若果一切顺利将可以输出 assembly 代码，但是我研究了一段时间，还是没有能够看懂这些代码，如果有网友能够解释得通上面说的两种现象，可以告诉我。

## assembly
以下是 **没有** volatile 修饰的 assembly 代码

```shell
Java HotSpot(TM) Server VM warning: PrintAssembly is enabled; turning on DebugNonSafepoints to gain additional output
CompilerOracle: dontinline *VisibilityTest.run
CompilerOracle: compileonly *VisibilityTest.run
Loaded disassembler from D:\Dev\Java\jdk1.7.0_25\jre\bin\server\hsdis-i386.dll
Decoding compiled method 0x0193be88:
Code:
Argument 0 is unknown.RIP: 0x193bf80 Code size: 0x00000050
[Disassembling for mach='i386']
[Entry Point]
[Constants]
  # {method} 'run' '()V' in 'edu/hushi/jvm/VisibilityTest'
  #           [sp+0x10]  (sp of caller)
  0x0193bf80: cmp     eax,dword ptr [ecx+4h]
  0x0193bf83: jne     191d100h          ;   {runtime_call}
  0x0193bf89: nop
[Verified Entry Point]
  0x0193bf8c: mov     dword ptr [esp+0ffffc000h],eax
  0x0193bf93: push    ebp
  0x0193bf94: sub     esp,8h            ;*synchronization entry
                                        ; - edu.hushi.jvm.VisibilityTest::run@-1 (line 13)
  0x0193bf97: mov     ebp,ecx
  0x0193bf99: movzx   eax,byte ptr [ecx+64h]  ;*getfield stop
                                        ; - edu.hushi.jvm.VisibilityTest::run@9 (line 14)
  0x0193bf9d: test    eax,eax
  0x0193bf9f: jne     193bfafh          ;*ifeq
                                        ; - edu.hushi.jvm.VisibilityTest::run@12 (line 14)
  0x0193bfa1: mov     ebx,1h            ; OopMap{ebp=Oop off=38}
                                        ;*ifeq
                                        ; - edu.hushi.jvm.VisibilityTest::run@12 (line 14)
  0x0193bfa6: test    dword ptr [0a0000h],edi  ;*ifeq
                                        ; - edu.hushi.jvm.VisibilityTest::run@12 (line 14)
                                        ;   {poll}
  0x0193bfac: inc     ebx               ;*iinc
                                        ; - edu.hushi.jvm.VisibilityTest::run@5 (line 15)
  0x0193bfad: jmp     193bfa6h
  0x0193bfaf: mov     ecx,14h
  0x0193bfb4: nop
  0x0193bfb7: call    191dd00h          ; OopMap{ebp=Oop off=60}
                                        ;*getstatic out
                                        ; - edu.hushi.jvm.VisibilityTest::run@15 (line 17)
                                        ;   {runtime_call}
  0x0193bfbc: int3                      ;*iinc
                                        ; - edu.hushi.jvm.VisibilityTest::run@5 (line 15)
  0x0193bfbd: int3
  0x0193bfbe: hlt
  0x0193bfbf: hlt
[Exception Handler]
[Stub Code]
  0x0193bfc0: jmp     1938780h          ;   {no_reloc}
[Deopt Handler Code]
  0x0193bfc5: push    193bfc5h          ;   {section_word}
  0x0193bfca: jmp     191e280h          ;   {runtime_call}
  0x0193bfcf: hlt
finish main
true
```

以下是 **有** volatile 修饰的 assembly 代码

```shell
Java HotSpot(TM) Server VM warning: PrintAssembly is enabled; turning on DebugNonSafepoints to gain additional output
CompilerOracle: dontinline *VisibilityTest.run
CompilerOracle: compileonly *VisibilityTest.run
Loaded disassembler from D:\Dev\Java\jdk1.7.0_25\jre\bin\server\hsdis-i386.dll
Decoding compiled method 0x01c7c688:
Code:
Argument 0 is unknown.RIP: 0x1c7c780 Code size: 0x00000050
[Disassembling for mach='i386']
[Entry Point]
[Constants]
  # {method} 'run' '()V' in 'edu/hushi/jvm/VisibilityTest'
  #           [sp+0x10]  (sp of caller)
  0x01c7c780: cmp     eax,dword ptr [ecx+4h]
  0x01c7c783: jne     1c5d100h          ;   {runtime_call}
  0x01c7c789: nop
[Verified Entry Point]
  0x01c7c78c: mov     dword ptr [esp+0ffffc000h],eax
  0x01c7c793: push    ebp
  0x01c7c794: sub     esp,8h            ;*synchronization entry
                                        ; - edu.hushi.jvm.VisibilityTest::run@-1 (line 13)
  0x01c7c797: movzx   eax,byte ptr [ecx+64h]  ;*getfield stop
                                        ; - edu.hushi.jvm.VisibilityTest::run@9 (line 14)
  0x01c7c79b: xor     ebp,ebp
  0x01c7c79d: test    eax,eax
  0x01c7c79f: jne     1c7c7b0h          ;*iinc
                                        ; - edu.hushi.jvm.VisibilityTest::run@5 (line 15)
  0x01c7c7a1: movzx   ebx,byte ptr [ecx+64h]  ;*getfield stop
                                        ; - edu.hushi.jvm.VisibilityTest::run@9 (line 14)
  0x01c7c7a5: inc     ebp               ; OopMap{ecx=Oop off=38}
                                        ;*ifeq
                                        ; - edu.hushi.jvm.VisibilityTest::run@12 (line 14)
  0x01c7c7a6: test    dword ptr [350000h],edi  ;   {poll}
  0x01c7c7ac: test    ebx,ebx
  0x01c7c7ae: je      1c7c7a1h          ;*getstatic out
                                        ; - edu.hushi.jvm.VisibilityTest::run@15 (line 17)
  0x01c7c7b0: mov     ecx,14h
  0x01c7c7b5: nop
  0x01c7c7b7: call    1c5dd00h          ; OopMap{off=60}
                                        ;*getstatic out
                                        ; - edu.hushi.jvm.VisibilityTest::run@15 (line 17)
                                        ;   {runtime_call}
  0x01c7c7bc: int3                      ;*getstatic out
                                        ; - edu.hushi.jvm.VisibilityTest::run@15 (line 17)
  0x01c7c7bd: hlt
  0x01c7c7be: hlt
  0x01c7c7bf: hlt
[Exception Handler]
[Stub Code]
  0x01c7c7c0: jmp     1c78f80h          ;   {no_reloc}
[Deopt Handler Code]
  0x01c7c7c5: push    1c7c7c5h          ;   {section_word}
  0x01c7c7ca: jmp     1c5e280h          ;   {runtime_call}
  0x01c7c7cf: hlt
finish loop,i=1109307815
finish main
true
```

以上测试环境为

- win7 32
- Java(TM) SE Runtime Environment (build 1.7.0_25-b17)
- Pentium(R) Dual-Core  CPU      E5400  @ 2.70GHz

## 参考

- [http://docs.oracle.com/javase/8/docs/technotes/tools/unix/java.html](http://docs.oracle.com/javase/8/docs/technotes/tools/unix/java.html#BABDDFII)
- [http://www.infoq.com/cn/articles/ftf-java-volatile](http://www.infoq.com/cn/articles/ftf-java-volatile)
- [http://www.infoq.com/cn/articles/zzm-java-hsdis-jvm](http://www.infoq.com/cn/articles/zzm-java-hsdis-jvm)
- [http://www.infoq.com/cn/articles/memory_barriers_jvm_concurrency](http://www.infoq.com/cn/articles/memory_barriers_jvm_concurrency)


[-10]:    http://hushi55.github.io/  "-10"
