---
layout: post
title: linux epoll example
description: linux 下 epoll 的一个 code example
category: code
tags: [c, epoll, linux]
---

```cgo
#include <netdb.h>
#include <sys/socket.h>
#include <sys/epoll.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>

/**
 * 创建并绑定一个socket作为服务器。
 */
static int  create_and_bind (char *port){

    struct  addrinfo hints;
    struct  addrinfo *result, *rp;
    int  s, sfd;

    memset (&hints, 0, sizeof (struct addrinfo));
    hints.ai_family = AF_UNSPEC;     /* Return IPv4 and IPv6 choices */
    hints.ai_socktype = SOCK_STREAM; /* 设置为STREAM模式，即TCP链接 */
    hints.ai_flags = AI_PASSIVE;     /* All interfaces */

    s = getaddrinfo (NULL, port, &hints, &result);//获得本地主机的地址

    if (s != 0){
        fprintf (stderr, "getaddrinfo: %s\n", gai_strerror (s));
        return -1;
    }

    for (rp = result; rp != NULL; rp = rp->ai_next){//本地主机地址可能有多个，任意绑定一个即可
        sfd = socket (rp->ai_family, rp->ai_socktype, rp->ai_protocol); //创建socket
        if (sfd == -1) {
                continue;
         }

        s = bind (sfd, rp->ai_addr, rp->ai_addrlen); //并绑定socket

        if (s == 0) {
            /* 绑定成功 */
            break;
        }

        close (sfd);
    }

    if (rp == NULL){
        fprintf (stderr, "Could not bind\n");
        return -1;
    }

    freeaddrinfo (result);

    return sfd;
}



/**
 * 设置socket为非阻塞模式。
 * 先get flag，或上O_NONBLOCK 再set flag。
 */
static  int   make_socket_non_blocking (int sfd) {

    int flags, s;

    flags = fcntl (sfd, F_GETFL, 0);

    if (flags == -1){
        perror ("fcntl");
        return -1;
    }

    flags |= O_NONBLOCK;
    s = fcntl (sfd, F_SETFL, flags);

    if (s == -1){
        perror ("fcntl");
        return -1;
    }

    return 0;
}


#define  MAXEVENTS 64

/**
 * 用法： ./epoll_test 8080
 */
int  main (int argc, char *argv[]) {

    int sfd, s;
    int efd;
    struct  epoll_event event;
    struct  epoll_event *events;

    if (argc != 2) {
        fprintf (stderr, "Usage: %s [port]\n", argv[0]);
        exit (EXIT_FAILURE);
    }

    sfd = create_and_bind (argv[1]); //sfd为绑定后等待连接接入的文件描述符

    s = make_socket_non_blocking (sfd);
    s = listen (sfd, SOMAXCONN);

    efd = epoll_create1 (0);
    event.data.fd = sfd;
    event.events = EPOLLIN | EPOLLET;

    s = epoll_ctl (efd, EPOLL_CTL_ADD, sfd, &event);

    /* Buffer where events are returned，为events数组分配内存 */
    events = (struct  epoll_event*)calloc (MAXEVENTS, sizeof event);

    /* The event loop 事件循环*/
    while (1) {
        int n, i;
        n = epoll_wait (efd, events, MAXEVENTS, -1);

        for (i = 0; i < n; i++) {

            if ((events[i].events & EPOLLERR)
                        ||  (events[i].events & EPOLLHUP)
                        || (!(events[i].events & EPOLLIN))) {

              /** 发生了错误或者被挂断，或者没有数据可读
                * An error has occured on this fd,
                * or the socket is not ready for reading (why were we notified then?)
                */

                fprintf (stderr, "epoll error\n");
                close (events[i].data.fd);
                continue;
            } else if (sfd == events[i].data.fd) {//新连接

              /**
               *sfd上有数据可读，则表示有新连接
               * We have a notification on the listening socket,
               * which means one or more incoming connections.
               */

                printf("Incoming connection !\n");

                while (1) {
                    struct sockaddr in_addr;
                    socklen_t in_len;
                    int infd;
                    char hbuf[NI_MAXHOST], sbuf[NI_MAXSERV];
                    in_len = sizeof in_addr;
                    infd = accept (sfd, &in_addr, &in_len); //读取到来的连接socket fd。

                    if (infd == -1) {
                        if ((errno == EAGAIN) || (errno == EWOULDBLOCK)) {
                            /**
                             *  已经读完了sfd上的所有数据（所有连接）。
                             *  最后一次读（非阻塞读）会返回EAGAIN（=EWOULDBLOCK）
                             * We have processed all incoming connections.
                             */

                            break;
                        } else  {
                            perror ("accept");
                            break;
                        }
                    }

                    s = getnameinfo (&in_addr, in_len, hbuf, sizeof hbuf,
                                        sbuf, sizeof sbuf, NI_NUMERICHOST | NI_NUMERICSERV);

                    if (s == 0) {
                        printf("Accepted connection on descriptor %d (host=%s, port=%s)\n", infd, hbuf, sbuf);
                        }

                    s = make_socket_non_blocking (infd);  //设置socket为非阻塞模式
                    event.data.fd = infd;  //将data部分设置为fd
                    event.events = EPOLLIN | EPOLLET;  //监听EPOLLIN事件，使用边缘触发模式

                    s = epoll_ctl (efd, EPOLL_CTL_ADD, infd, &event);
                }

                continue;

            } else {//有客户端发来数据

                /**
                 * 有客户端发来数据，因为处于ET模式，所以必须完全读取所有数据
                 * （要不然，剩下一部分数据后，就无法再收到内核通知了）。
                 */

                int done = 0;

                while (1) {

                    ssize_t count;
                    char buf[512];

                    count = read (events[i].data.fd, buf, sizeof buf);

                    if (count == -1) {
                        if (errno != EAGAIN) { //如果errno=EAGAIN，表示我们已经读取了所有的数据
                            perror ("read");
                            done = 1;
                        }
                        break;
                    } else if (count == 0) {  //读到文件尾（对端被关闭了）
                        /* End of file. The remote has closed the connection. */
                        done = 1;
                        break;
                    }

                    s = write (1, buf, count); /* 打印到屏幕 */

                }

                if (done) { //读完关闭（假设应用对每个连接只读取一次数据）
                    printf ("Closed connection on descriptor %d\n", events[i].data.fd);

                    /**
                     *  Closing the descriptor will make epoll remove it
                     *  from the set of descriptors which are monitored.
                     */

                    close (events[i].data.fd);
                }
            }
        }
    }

    free (events);//释放内存
    close (sfd);   //关闭sfd
    return EXIT_SUCCESS;
}
```


## 参考
- [http://www.cnblogs.com/apprentice89/archive/2013/05/06/3063039.html](http://www.cnblogs.com/apprentice89/archive/2013/05/06/3063039.html)


[-10]:    http://hushi55.github.io/  "-10"
