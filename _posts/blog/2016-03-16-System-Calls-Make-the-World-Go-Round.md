---
layout: post
title: System Calls Make the World Go Round
description: system call 详解
category: blog
tags: [linux, translation]
---
I hate to break it to you, but a user application is a helpless brain in a vat:

`我本不想说破这个，但是当将一个应用层放在整个系统里来说是不明智的`

![](/images/blog/gustavo/appInVat.png)

Every interaction with the outside world is mediated by the kernel through system calls. If an app saves a file, 
writes to the terminal, or opens a TCP connection, the kernel is involved. 
Apps are regarded as highly suspicious: at best a bug-ridden mess, at worst the malicious brain of an evil genius.

`system call 是外部和 kernel 交互的一个桥梁。当一个应用要保存一个文件，写终端，打开一个 tcp 链接，这些都会要和 kernel 交互。应用程序是高度危险的，在最好的情况下，
可能是引入了一些 bug，但是在最坏的情况下可能会使得系统崩溃`

These system calls are function calls from an app into the kernel. They use a specific mechanism for safety reasons, 
but really you’re just calling the kernel’s API. 
The term “system call” can refer to a specific function offered by the kernel (e.g., the open() system call) 
or to the calling mechanism. You can also say syscall for short.

`system calls 是一些从应用层函数调用到 kernel。因为安全原因会使用一些特殊的机制，但是实际上我们看到只是 kernel 的一些 API。system call 这个专用术语可以是 kernel 
中具体函数的代称，也可以称为一种机制，我们也可以简短的称为 syscall。`

This post looks at system calls, how they differ from calls to a library, and tools to poke at this OS/app interface. 
A solid understanding of what happens within an app versus 
what happens through the OS can turn an impossible-to-fix problem into a quick, fun puzzle.

`这篇文章看起来是讲解 system calls，但是不同于介绍 OS/app 之间 lib 库的使用。这里是讲解 system call 在 app 和 kernel 之间发生的直接，和怎么样快速的解决一些疑问。`

So here’s a running program, a user process:

`这里有个运行的程序示意图：`

![](/images/blog/gustavo/sandbox.png)

It has a private virtual address space, its very own memory sandbox. 
The vat, if you will. In its address space, the program’s binary file plus the libraries it uses are all memory mapped. 
Part of the address space maps the kernel itself.

`进程自己有自己的私有地址空间，这是一个内存沙盒模型。进程的二进制文件和共享 lib 库都会在内存中映射，一部分还会映射到 kernel 自身的内存。`

Below is the code for our program, pid, which simply retrieves its process id via getpid(2):

`下面的代码展示了我们的程序简单的通过 getpid(2) 获取 pid。`

```
#include <sys/types.h>
#include <unistd.h>
#include <stdio.h>

int main()
{
    pid_t p = getpid();
    printf("%d\n", p);
}
```

In Linux, a process isn’t born knowing its PID. It must ask the kernel, so this requires a system call:

`在 linux 中，一个进程自己无法知道自己的 PID，这个必须和 kernel 交互，所以必须通过一个 system call：`

![](/images/blog/gustavo/syscallEnter.png)

It all starts with a call to the C library’s getpid(), which is a wrapper for the system call. 
When you call functions like open(2), read(2), and friends, you’re calling these wrappers. 
This is true for many languages where the native methods ultimately end up in libc.

`这个的起点是 C lib 库中的 getpid()，这个函数包装了 system call。这个就像我们调用 open(2), read(2) 函数一样有好。基本上大部分的语言都是通过 libc 来封装。`

Wrappers offer convenience atop the bare-bones OS API, helping keep the kernel lean. 
Lines of code is where bugs live, and all kernel code runs in privileged mode, where mistakes can be disastrous. 
Anything that can be done in user mode should be done in user mode. 
Let the libraries offer friendly methods and fancy argument processing a la printf(3).

`封装提供了从顶层暴露 OS API 的遍历，有利于学习 kernel。代码都会存在 bug，所有的 kernel code 都运行在特权模式下，如果有错误这将是致命的。
如是可以在用户模式下完成的功能，就应该在用户模式下完成。让 lib 来提供有友好的接口。`

Compared to web APIs, 
this is analogous to building the simplest possible HTTP interface to a service 
and then offering language-specific libraries with helper methods. 
Or maybe some caching, which is what libc’s getpid() does: when first called it actually performs a system call, 
but the PID is then cached to avoid the syscall overhead in subsequent invocations.

`对比与 web 的 APIs，这个是类似的。最简单的 htttp 服务接口都会提供一个语言级别的帮助函数。
当由于一些缓存原因，getpid() 调用过程：首先这个会调用执行一个 system call，但是这时会将 PID cache 住，避免随后系统调用的开销。`

Once the wrapper has done its initial work it’s time to jump into hyperspace the kernel. 
The mechanics of this transition vary by processor architecture. 
In Intel processors, arguments and the syscall number are loaded into registers, 
then an instruction is executed to put the CPU in privileged mode and immediately transfer control to 
a global syscall entry point within the kernel. 
If you’re interested in details, David Drysdale has two great articles in LWN ([first], [second]).

`一旦包装的函数完成了初始化的工作后，就会跳转进入到 kernel 空间中。这个转换机制不同的处理器架构，有不同的方式。Intel 处理器，syscall 的标示和参数是通过寄存器来传递的，
这是指令会在特权模式下执行，syscall 的进入点是个全局的。如果你对这个感兴趣，David Drysdale 有连篇很好的文章在 LWN 中(first, second)`

The kernel then uses the syscall number as an index into sys_call_table, 
an array of function pointers to each syscall implementation. Here, sys_getpid is called:

`kernel 使用 syscall number 在  sys_call_table 中的索引，这个是通过一个函数指针数组来实现的。这里是 sys_getpid 被调用：`

![](/images/blog/gustavo/syscallExit.png)

In Linux, syscall implementations are mostly arch-independent C functions, sometimes trivial, 
insulated from the syscall mechanism by the kernel’s excellent design. 
They are regular code working on general data structures. 
Well, apart from being completely paranoid about argument validation.

`在 linux 中，syscall 的实现大部门是依赖 C 的函数，这个是基于 linux kernel 优秀的架构设计的。这个是工作在通用的数据结构上，当然包括完整的严格的参数检测。`

Once their work is done they return normally, 
and the arch-specific code takes care of transitioning back into user mode where the wrapper does some post processing. 
In our example, getpid(2) now caches the PID returned by the kernel. 
Other wrappers might set the global errno variable if the kernel returns an error. 
Small things to let you know GNU cares.

`一旦 kernel 的工作完成，就返回用户层了，`

If you want to be raw, glibc offers the syscall(2) function, which makes a system call without a wrapper. 
You can also do so yourself in assembly. There’s nothing magical or privileged about a C library.

This syscall design has far-reaching consequences. Let’s start with the incredibly useful strace(1), 
a tool you can use to spy on system calls made by Linux processes (in Macs, see dtruss(1m) and the amazing dtrace; 
in Windows, see sysinternals). Here’s strace on pid:

```
~/code/x86-os$ strace ./pid

execve("./pid", ["./pid"], [/* 20 vars */]) = 0
brk(0)                                  = 0x9aa0000
access("/etc/ld.so.nohwcap", F_OK)      = -1 ENOENT (No such file or directory)
mmap2(NULL, 8192, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0xb7767000
access("/etc/ld.so.preload", R_OK)      = -1 ENOENT (No such file or directory)
open("/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
fstat64(3, {st_mode=S_IFREG|0644, st_size=18056, ...}) = 0
mmap2(NULL, 18056, PROT_READ, MAP_PRIVATE, 3, 0) = 0xb7762000
close(3)                                = 0

[...snip...]

getpid()                                = 14678
fstat64(1, {st_mode=S_IFCHR|0600, st_rdev=makedev(136, 1), ...}) = 0
mmap2(NULL, 4096, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0xb7766000
write(1, "14678\n", 614678)                  = 6
exit_group(6)                           = ?
```

Each line of output shows a system call, its arguments, and a return value. 
If you put getpid(2) in a loop running 1000 times, you would still have only one getpid() syscall 
because of the PID caching. We can also see that printf(3) calls write(2) after formatting the output string.

strace can start a new process and also attach to an already running one. 
You can learn a lot by looking at the syscalls made by different programs. 
For example, what does the sshd daemon do all day?

```
~/code/x86-os$ ps ax | grep sshd
12218 ?        Ss     0:00 /usr/sbin/sshd -D

~/code/x86-os$ sudo strace -p 12218
Process 12218 attached - interrupt to quit
select(7, [3 4], NULL, NULL, NULL

[
  ... nothing happens ... 
  No fun, it's just waiting for a connection using select(2)
  If we wait long enough, we might see new keys being generated and so on, but
  let's attach again, tell strace to follow forks (-f), and connect via SSH
]

~/code/x86-os$ sudo strace -p 12218 -f

[lots of calls happen during an SSH login, only a few shown]

[pid 14692] read(3, "-----BEGIN RSA PRIVATE KEY-----\n"..., 1024) = 1024
[pid 14692] open("/usr/share/ssh/blacklist.RSA-2048", O_RDONLY|O_LARGEFILE) = -1 ENOENT (No such file or directory)
[pid 14692] open("/etc/ssh/blacklist.RSA-2048", O_RDONLY|O_LARGEFILE) = -1 ENOENT (No such file or directory)
[pid 14692] open("/etc/ssh/ssh_host_dsa_key", O_RDONLY|O_LARGEFILE) = 3
[pid 14692] open("/etc/protocols", O_RDONLY|O_CLOEXEC) = 4
[pid 14692] read(4, "# Internet (IP) protocols\n#\n# Up"..., 4096) = 2933
[pid 14692] open("/etc/hosts.allow", O_RDONLY) = 4
[pid 14692] open("/lib/i386-linux-gnu/libnss_dns.so.2", O_RDONLY|O_CLOEXEC) = 4
[pid 14692] stat64("/etc/pam.d", {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0
[pid 14692] open("/etc/pam.d/common-password", O_RDONLY|O_LARGEFILE) = 8
[pid 14692] open("/etc/pam.d/other", O_RDONLY|O_LARGEFILE) = 4
```

SSH is a large chunk to bite off, but it gives a feel for strace usage. 
Being able to see which files an app opens can be useful (“where the hell is this config coming from?”). 
If you have a process that appears stuck, you can strace it and see what it might be doing via system calls. 
When some app is quitting unexpectedly without a proper error message, check if a syscall failure explains it. 
You can also use filters, time each call, and so so:

```
~/code/x86-os$ strace -T -e trace=recv curl -silent www.google.com. > /dev/null

recv(3, "HTTP/1.1 200 OK\r\nDate: Wed, 05 N"..., 16384, 0) = 4164 <0.000007>
recv(3, "fl a{color:#36c}a:visited{color:"..., 16384, 0) = 2776 <0.000005>
recv(3, "adient(top,#4d90fe,#4787ed);filt"..., 16384, 0) = 4164 <0.000007>
recv(3, "gbar.up.spd(b,d,1,!0);break;case"..., 16384, 0) = 2776 <0.000006>
recv(3, "$),a.i.G(!0)),window.gbar.up.sl("..., 16384, 0) = 1388 <0.000004>
recv(3, "margin:0;padding:5px 8px 0 6px;v"..., 16384, 0) = 1388 <0.000007>
recv(3, "){window.setTimeout(function(){v"..., 16384, 0) = 1484 <0.000006>
```

I encourage you to explore these tools in your OS. Using them well is like having a super power.

But enough useful stuff, let’s go back to design. 
We’ve seen that a userland app is trapped in its virtual address space running in ring 3 (unprivileged). 
In general, tasks that involve only computation and memory accesses do not require syscalls. 
For example, C library functions like strlen(3) and memcpy(3) have nothing to do with the kernel. 
Those happen within the app.

The man page sections for a C library function (the 2 and 3 in parenthesis) also offer clues. 
Section 2 is used for system call wrappers, while section 3 contains other C library functions. 
However, as we saw with printf(3), a library function might ultimately make one or more syscalls.

If you’re curious, here are full syscall listings for Linux (also Filippo’s list) and Windows. 
They have ~310 and ~460 system calls, respectively. It’s fun to look at those because, 
in a way, they represent all that software can do on a modern computer. 
Plus, you might find gems to help with things like interprocess communication and performance. 
This is an area where “Those who do not understand Unix are condemned to reinvent it, poorly.”

Many syscalls perform tasks that take eons compared to CPU cycles, for example reading from a hard drive. 
In those situations the calling process is often put to sleep until the underlying work is completed. 
Because CPUs are so fast, your average program is I/O bound and spends most of its life sleeping, 
waiting on syscalls. By contrast, if you strace a program busy with a computational task, 
you often see no syscalls being invoked. In such a case, top(1) would show intense CPU usage.

The overhead involved in a system call can be a problem. 
For example, SSDs are so fast that general OS overhead can be more expensive than the I/O operation itself. 
Programs doing large numbers of reads and writes can also have OS overhead as their bottleneck. 
Vectored I/O can help some. So can memory mapped files, 
which allow a program to read and write from disk using only memory access. 
Analogous mappings exist for things like video card memory. 
Eventually, the economics of cloud computing might lead us to kernels that eliminate or minimize user/kernel mode switches.

Finally, syscalls have interesting security implications. One is that no matter how obfuscated a binary, 
you can still examine its behavior by looking at the system calls it makes. This can be used to detect malware, 
for example. We can also record profiles of a known program’s syscall usage and alert on deviations, 
or perhaps whitelist specific syscalls for programs so that exploiting vulnerabilities becomes harder. 
We have a ton of research in this area, a number of tools, but not a killer solution yet.

And that’s it for system calls. I’m sorry for the length of this post, I hope it was helpful. 
More (and shorter) next week, RSS and Twitter. Also, last night I made a promise to the universe. 
This post is dedicated to the glorious Clube Atlético Mineiro.

## 参考
- [System Calls Make the World Go Round](http://duartes.org/gustavo/blog/post/system-calls/)

[-10]:    http://hushi55.github.io/  "-10"
[first]:  http://lwn.net/Articles/604287/ "first"
[second]: http://lwn.net/Articles/604515/ "second"


