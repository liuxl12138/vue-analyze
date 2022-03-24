/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

   constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    console.log(this.dep.id)
    console.log(value)
    this.vmCount = 0
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      //hasProto：检测当前环境是否可以使用对象的__proto__属性，
      const augment = hasProto
        ? protoAugment
        : copyAugment
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
/**
 * 尝试为一个值创建一个观察者实例，
 * 如果成功观察，则返回新的观察者，
 * 或现有的观察者，如果该值已经有一个。
 * @param {*} value 要观察的值
 * @param {*} asRootData  asRootData 如果添加响应的对象是 data，asRootData 是 true；如果data某个属性的属性值是对象则为false
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  //必须是一个对象，而且不能是一个vnode实例
  if (!isObject(value) || value instanceof VNode) {
    return
  }

  let ob: Observer | void
  //已经是一个响应式对象，
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    //
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    //判断对象是否可扩展
    //默认情况下，对象是可扩展的：即可以为他们添加新的属性。以及它们的 __proto__ 属性可以被更改。
    //Object.preventExtensions，Object.seal 或 Object.freeze 方法都可以标记一个对象为不可扩展（non-extensible）。
    Object.isExtensible(value) &&
    //不是一个vue实例
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()
  console.log(dep.id)
  console.log(obj[key])
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  
  if ((!getter || setter)  && arguments.length === 2) {
    val = obj[key]
  }

  //如果val还是一个对象，递归调用observe，给每一层的值添加响应式
  //返回值是一个observer对象
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        //把当前watcher添加到dep的subs中
        dep.depend()
        if (childOb) {
          // 这样做的目的是
          // 1. 当执行数组的某些方法时，可以更新视图
              // 因为调用数组的某些方法其实会手动触发更新，但是更新的是数组 dep 里面存放的Watcher，所以在依赖收集过程中，需要将这个Watcher存放到数组的Dep实例里面
          // 2. 通过 $set 给对象添加属性时，可以更新视图（原因和第一条相同）
          childOb.dep.depend()
          if (Array.isArray(value)) {
            // 如果是数组并且数组元素中有对象，将这个 Watcher 添加到对象的 dep.subs 中
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      //先取得之前的值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */

      //新旧值相等，直接返回
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }

      //设置新值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }

      //如果新值是对象，给新值添加响应
      childOb = !shallow && observe(newVal)
      // 通知所有订阅更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  //如果是undefined 或者 null 或者 基础类型，不能调用set方法
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 数组值插入
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    //数组的长度是key和length的最大值
    target.length = Math.max(target.length, key)
    // 把值插入对应的位置
    target.splice(key, 1, val)
    return val
  }

  //对象的处理
  //如果key存在对象上，直接赋值，因为已经有响应式了
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  // 如果对象是vue或者vue.data,报错（只有vue。data有vmCount）
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  //target如果不是响应式，说明target是一个普通类型的值，直接给他赋值
  if (!ob) {
    target[key] = val
    return val
  }
  //走到这里说明是一个响应式对象，给 ob.value也就是target这个对象，添加一个key，值为val
  defineReactive(ob.value, key, val)
  //如果不手动派发更新，target这个对象不会触发set，也就不会更新视图，
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
