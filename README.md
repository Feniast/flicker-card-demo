# flicker-card-demo
A demo of using `react-spring` and `react-use-gesture`.
Inspiration from [spotify](https://spotify.design/).

## How to start

```bash
yarn
yarn start
```

## 实现的效果
1. 自动切换（autoplay）
2. 循环（loop）
3. shuffle
4. 其他状态同步（背景，标题，进度条）
5. 滑动切换
6. 手动前后切换

![image](https://github.com/Feniast/flicker-card-demo/blob/master/flicker-cards.gif)

##
PS: 本人前端菜狗，做着玩，无意义

将slide的状态维护在一个useSlide的hook里，其实只有一个index，返回诸如next, prev, start, pause等方法，来控制index的切换和autoplay。

+ 为什么没有返回一个progress值而用onProgress回调呢？

因为用了raf来计算是否到了autoplay的interval，progress在这个raf的tick里计算，如果用setState的话，会GG~

+ 为什么在autoplay的时间到了之后停止tick?

因为navigate本身只负责切换index, 画面上如何切换交由hook调用方，可以是异步操作。想在切换动画结束之后再重新启动tick，所以到切换的时间点先取消tick。
等navigate的操作完成，重新启动tick。

+ 为什么用了一个locking值?

因为在navigate的执行过程中有个异步操作，不希望在该操作完成前触发autoplay。而locking值为什么用index控制，而不是boolean呢？正因为是异步操作，
外部调用方可以频繁调用next或prev，先前的navigate结束后会直接解锁重新启动autoplay的tick，这时候就会造成一些意外的效果，所以呢存的是index，
（更好的是存一个timestamp）,最后进来的navigate会覆盖之前的，之前的navigate结束后判断locking值与自己设定的不符，就跳过了解锁操作。
