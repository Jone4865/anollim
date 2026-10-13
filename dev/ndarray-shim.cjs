// CSP 친화 ndarray 대체품: 원래 ndarray 는 new Function 으로 코드를 만들어서
// 'unsafe-eval' 없는 CSP 에서 막혀요. @imgly/background-removal 이 쓰는
// ndarray(data, shape) / .data / .shape / .stride / .get() / .set() 만 구현해요.
function NDArray(data, shape, stride, offset) {
  this.data = data;
  this.shape = shape;
  this.stride = stride;
  this.offset = offset;
}
NDArray.prototype.index = function () {
  let i = this.offset;
  for (let k = 0; k < arguments.length; k++) i += this.stride[k] * arguments[k];
  return i;
};
NDArray.prototype.get = function () { return this.data[this.index.apply(this, arguments)]; };
NDArray.prototype.set = function () {
  const n = arguments.length - 1;
  let i = this.offset;
  for (let k = 0; k < n; k++) i += this.stride[k] * arguments[k];
  return (this.data[i] = arguments[n]);
};
Object.defineProperty(NDArray.prototype, "size", { get() { return this.shape.reduce((a, b) => a * b, 1); } });
Object.defineProperty(NDArray.prototype, "dimension", { get() { return this.shape.length; } });
module.exports = function ndarray(data, shape, stride, offset) {
  shape = shape ? shape.slice() : [data.length];
  if (!stride) {
    stride = new Array(shape.length);
    for (let i = shape.length - 1, sz = 1; i >= 0; i--) { stride[i] = sz; sz *= shape[i]; }
  }
  return new NDArray(data, shape, stride, offset || 0);
};
