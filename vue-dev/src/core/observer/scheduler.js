/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []  //队列，存储要执行的watcher
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}  //保证同一个watcher只添加一次
let circular: { [key: number]: number } = {} //保证对 nextTick(flushSchedulerQueue) 的调用逻辑在同一时刻只有一次
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
    /**
     * 为什么要排序？
     *   1.先执行父组件的watcher，再执行子组件的watcher。     2.user watcher 在render watcher之前。 3.父组件销毁，子组件不再执行watcher
     */
  // 对队列中的Watcher排序，根据 id 从小到大
  queue.sort((a, b) => a.id - b.id)
  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  //每次都要求值queue.length，因为queue是会变得
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      // Render Watcher 有 before 方法，会执行 beforeUpdate 钩子, 先父后子
      watcher.before()
    }
    id = watcher.id

    // 将 has 里面对应的 id 变成 null
    has[id] = null

    // 调用 watcher.run 方法触发更新
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {

      //因为有可能会循环更新，每个watcher执行一次，circular[id]就加一，当执行次数大于 100 时，会报错，循环执行
      //循环更新例子：
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // 清空 queue、has、circular，并将 waiting、flushing 置为 false
  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()
  //重置状态
  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  //执行updated钩子函数
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function   queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    //多个属性触发了同一个watcher，只会添加一次
    has[id] = true
    //然后如果flushing为false，则将 Watcher 添加到队列中； flushing为false说明没有在执行队列 
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    //如果waiting为false，说明当前时刻没有nextTick等待执行，调用nextTick(flushSchedulerQueue)

    //比如一次派发了多个watcher更新，第一个watcher调用了nextTick(flushSchedulerQueue)，启动了一个异步任务
    //第二个watcher加入到queue之后，运行到这里，waiting=true，就不会再启动一个异步任务，等异步任务 flushSchedulerQueue执行时，会将queue中的watcher全部调用
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
