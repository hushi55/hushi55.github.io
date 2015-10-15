---
layout: post
title: page fault
description: linux page fault 的各种错误类型
category: code
tags: [linux, kernel]
---
关于 linux 内存管理的一些知识点。下面是缺页的各种情况

<pre class="nowordwrap">
/*
 * Different kinds of faults, as returned by handle_mm_fault().
 * Used to decide whether a process gets delivered SIGBUS or
 * just gets major/minor fault counters bumped up.
 */

#define VM_FAULT_MINOR  0 /* For backwards compat. Remove me quickly. */

#define VM_FAULT_OOM    0x0001
#define VM_FAULT_SIGBUS 0x0002
#define VM_FAULT_MAJOR  0x0004
#define VM_FAULT_WRITE  0x0008  /* Special case for get_user_pages */
#define VM_FAULT_HWPOISON 0x0010        /* Hit poisoned small page */
#define VM_FAULT_HWPOISON_LARGE 0x0020  /* Hit poisoned large page. Index encoded in upper bits */
#define VM_FAULT_SIGSEGV 0x0040

#define VM_FAULT_NOPAGE 0x0100  /* ->fault installed the pte, not return page */
#define VM_FAULT_LOCKED 0x0200  /* ->fault locked the returned page */
#define VM_FAULT_RETRY  0x0400  /* ->fault blocked, must retry */
#define VM_FAULT_FALLBACK 0x0800        /* huge page fault failed, fall back to small */

#define VM_FAULT_HWPOISON_LARGE_MASK 0xf000 /* encodes hpage index for large hwpoison */

#define VM_FAULT_ERROR  (VM_FAULT_OOM | VM_FAULT_SIGBUS | VM_FAULT_SIGSEGV | \
                         VM_FAULT_HWPOISON | VM_FAULT_HWPOISON_LARGE | \
                         VM_FAULT_FALLBACK)
</pre>

- VM_FAULT_MINOR 表明该页数据已经在内存中了，这种情况不会阻塞进程
- VM_FAULT_MAJOR 表明数据需要从块设备中读取，这种情况会阻塞进程

提供一个 systemtap 脚本

<pre>
[root@docker221 memory]# pwd
/usr/share/systemtap-2.9-3823/share/doc/systemtap/examples/memory
[root@docker221 memory]# cat pfaults.stp 
#! /usr/bin/env stap

global fault_entry_time, fault_address, fault_access
global time_offset

probe begin { time_offset = gettimeofday_us() }

probe vm.pagefault {
  t = gettimeofday_us()
  fault_entry_time[tid()] = t
  fault_address[tid()] = address
  fault_access[tid()] = write_access ? "w" : "r"
}

probe vm.pagefault.return {
  t=gettimeofday_us()
  if (!(tid() in fault_entry_time)) next
  e = t - fault_entry_time[id]
  if (vm_fault_contains(fault_type,VM_FAULT_MINOR)) {
    ftype="minor"
  } else if (vm_fault_contains(fault_type,VM_FAULT_MAJOR)) {
    ftype="major"
  } else {
    next #only want to deal with minor and major page faults
  }

  printf("%d:%d:%id:%s:%s:%d\n",
	t - time_offset, tid(), fault_address[tid()], fault_access[tid()], ftype, e)
  #free up memory
  delete fault_entry_time[tid()]
  delete fault_address[tid()]
  delete fault_access[tid()]
}
</pre>



## 参考

- http://tomoyo.osdn.jp/cgi-bin/lxr/source/include/linux/mm.h#L1028

[-10]:    http://hushi55.github.io/  "-10"
