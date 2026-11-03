/** Original parameter curves, independent of third-party character assets. */
const curve = (Id, values) => ({Id, Target: 'Parameter', Segments: [0, values[0], ...values.slice(1).flatMap((v, i) => [0, (i + 1) * 2, v])]})
export const defaultIdleMotion = {
 Meta: {Duration: 8, Fps: 30},
 Curves: [
  curve('ParamAngleX', [0, -26, 0, 20, 0]),
  curve('ParamAngleY', [0, -12, 0, 8, 0]),
  curve('ParamAngleZ', [0, 3, 0, -3, 0]),
  curve('ParamBodyAngleX', [0, -3, 0, 3, 0]),
  curve('ParamBreath', [0, 1, 0, 1, 0]),
  curve('ParamEyeLOpen', [1, 1, 1, 1, 1]),
  curve('ParamEyeROpen', [1, 1, 1, 1, 1]),
 ]
}
