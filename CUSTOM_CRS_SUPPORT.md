# Custom CRS Support in MapLibre GL JS

This document describes the custom coordinate reference system (CRS) support added to MapLibre GL JS, which addresses [issue #5764](https://github.com/maplibre/maplibre-gl-js/issues/5764).

## Overview

MapLibre GL JS now supports rendering maps in custom coordinate reference systems beyond Web Mercator. This enables use cases such as:

- **Regional mapping**: Rendering tiles in regional projections like EPSG:2193 (New Zealand Transverse Mercator)
- **Polar research**: Using Universal Polar Stereographic projections (EPSG:5041/5042, EPSG:32661/32761)
- **Custom projections**: Supporting any projection defined in proj4 format

## Architecture

The custom CRS support is built on three main components:

### 1. CustomCRSProjection

The `CustomCRSProjection` class implements the `Projection` interface and provides:

- Integration with the proj4 library for coordinate transformations
- Configuration of CRS bounds and properties
- Transformation between WGS84 and the custom CRS
- Normalization of coordinates for rendering

### 2. CustomCRSTransform

The `CustomCRSTransform` class extends `MercatorTransform` and provides:

- Screen-to-geographic and geographic-to-screen coordinate transformations
- Integration of proj4 transformations into the rendering pipeline
- Reuse of existing Mercator rendering infrastructure

### 3. Projection Factory

The `createCustomCRSProjection` function creates a complete projection setup including:

- The projection instance
- The transform instance
- The camera helper

## Usage

### Basic Example

```typescript
import {createCustomCRSProjection, Map} from 'maplibre-gl';

// Define the custom CRS configuration
const nztmConfig = {
  code: 'EPSG:2193',
  definition: '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  bounds: [274000, 3087000, 3327000, 7173000] // NZTM bounds
};

// Create the custom CRS projection
const {projection, transform, cameraHelper} = createCustomCRSProjection(nztmConfig);

// Use the projection for coordinate transformations
const [lng, lat] = [174.0, -41.0]; // Wellington, NZ
const [x, y] = projection.transformFromWGS84(lng, lat);
console.log(`NZTM coordinates: ${x}, ${y}`);

// Transform back to WGS84
const [lngBack, latBack] = projection.transformToWGS84(x, y);
console.log(`Back to WGS84: ${lngBack}, ${latBack}`);
```

### Configuration Options

```typescript
interface CustomCRSConfig {
  /**
   * The EPSG code or proj4 definition string for the CRS
   * @example 'EPSG:2193'
   */
  code: string;

  /**
   * Optional proj4 definition string. If not provided, proj4 must have the CRS defined.
   */
  definition?: string;

  /**
   * The bounds of the CRS in its native units [minX, minY, maxX, maxY]
   * These are used to normalize coordinates to the 0-1 range for rendering
   */
  bounds: [number, number, number, number];

  /**
   * Whether this CRS uses subdivision (default: false)
   * Set to true for projections that have significant distortion
   */
  useSubdivision?: boolean;
}
```

### Common CRS Examples

#### New Zealand Transverse Mercator 2000 (EPSG:2193)

```typescript
const nztmConfig = {
  code: 'EPSG:2193',
  definition: '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  bounds: [274000, 3087000, 3327000, 7173000]
};
```

#### WGS 84 / Antarctic Polar Stereographic (EPSG:3031)

```typescript
const antarcticConfig = {
  code: 'EPSG:3031',
  definition: '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  bounds: [-4200000, -4200000, 4200000, 4200000],
  useSubdivision: true // Polar projections benefit from subdivision
};
```

#### WGS 84 / Arctic Polar Stereographic (EPSG:3995)

```typescript
const arcticConfig = {
  code: 'EPSG:3995',
  definition: '+proj=stere +lat_0=90 +lat_ts=71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  bounds: [-4200000, -4200000, 4200000, 4200000],
  useSubdivision: true
};
```

## Current Implementation Status

### ✅ Implemented

- [x] Core projection infrastructure using proj4
- [x] Coordinate transformation between WGS84 and custom CRS
- [x] Projection factory for creating custom CRS instances
- [x] Basic transform implementation extending MercatorTransform
- [x] Public API exports
- [x] Example demonstrating EPSG:2193
- [x] Documentation

### ⚠️ Limitations

This initial implementation is a **proof-of-concept** that demonstrates the architecture and coordinate transformation capabilities. The following limitations exist:

1. **Map Integration**: The custom transform is not yet fully integrated with the Map class. Maps still use the default Mercator or Globe projections.

2. **Tile CRS**: Vector tiles are assumed to be in Web Mercator (EPSG:3857). There's no per-source CRS specification yet.

3. **Shader Support**: Custom projections currently fall back to Mercator shaders. Full shader support would require:
   - Custom shader variants for different projection types
   - GPU-side coordinate transformations
   - Handling of projection-specific distortions

4. **Performance**: Coordinate transformations happen on the CPU. For optimal performance, transformations should be moved to shaders where possible.

5. **Tile Fetching**: Tile URLs still use standard Web Mercator tile coordinates. Support for tiles in other CRS would require:
   - Source-level CRS configuration
   - Tile coordinate transformation
   - WMTS/TMS support for different tile grids

6. **Projection Properties**: Different projections have different properties (e.g., bounds, units, distortion). These are not fully handled yet.

### 🔄 Future Work

To make custom CRS support production-ready, the following work is needed:

#### High Priority

1. **Map Integration**
   - Allow specifying custom CRS when creating a Map
   - Store and use the custom transform throughout the map lifecycle
   - Update the projection API to support custom CRS

2. **Per-Source CRS**
   - Add `crs` property to source specifications
   - Transform tile coordinates based on source CRS
   - Support WMTS/TMS tile grids

3. **Shader Support**
   - Create custom shader variants for common projection types
   - Implement GPU-side coordinate transformations
   - Handle projection-specific rendering requirements

#### Medium Priority

4. **Performance Optimization**
   - Move coordinate transformations to shaders where possible
   - Cache transformation results
   - Optimize for common projections

5. **Enhanced Camera Controls**
   - Create custom camera helpers for different projection types
   - Handle zoom levels in native CRS units
   - Proper bounds constraining for non-rectangular bounds

6. **Projection Metadata**
   - Store and expose projection properties (units, bounds, etc.)
   - Validate coordinates against projection bounds
   - Handle coordinate wrapping/clamping appropriately

#### Low Priority

7. **Testing**
   - Unit tests for coordinate transformations
   - Integration tests for different CRS
   - Visual regression tests

8. **Documentation**
   - User guide for custom CRS
   - API reference documentation
   - More examples for different use cases

9. **Developer Tools**
   - Debug visualization of coordinate transformations
   - CRS information in developer tools
   - Tile grid visualization

## Technical Details

### Coordinate Flow

The coordinate transformation flow for custom CRS is:

```
Geographic (WGS84)
    ↓ proj4.forward()
Custom CRS Coordinates
    ↓ normalize based on bounds
Normalized Coordinates [0, 1]
    ↓ render as MercatorCoordinate
Screen Coordinates
```

This approach allows reuse of the existing Mercator rendering pipeline while supporting arbitrary CRS.

### Projection Interface

Custom CRS projections implement the standard `Projection` interface:

```typescript
interface Projection {
  name: string;
  useSubdivision: boolean;
  shaderVariantName: string;
  shaderDefine: string;
  shaderPreludeCode: PreparedShader;
  vertexShaderPreludeCode: string;
  subdivisionGranularity: SubdivisionGranularitySetting;
  transitionState: number;
  latitudeErrorCorrectionRadians: number;

  destroy(): void;
  updateGPUdependent(context: ProjectionGPUContext): void;
  getMeshFromTileID(...): Mesh;
  recalculate(params: EvaluationParameters): void;
  hasTransition(): boolean;
  setErrorQueryLatitudeDegrees(value: number): void;
}
```

### Transform Interface

Custom CRS transforms extend `MercatorTransform` and override:

- `locationToScreenPoint(lnglat)` - Geographic to screen
- `screenPointToLocation(point)` - Screen to geographic
- Additional CRS-specific methods

## Dependencies

- **proj4**: v2.x or later (automatically installed)
- **@types/proj4**: Type definitions (dev dependency)

The proj4 library adds approximately 50KB (minified) to the bundle size.

## Examples

See the [custom-crs-nztm.html](examples/custom-crs-nztm.html) example for a complete demonstration of:

- Creating a custom CRS projection
- Performing coordinate transformations
- Displaying coordinates in both WGS84 and custom CRS
- Adding markers using custom CRS coordinates

## API Reference

### createCustomCRSProjection

```typescript
function createCustomCRSProjection(
  config: CustomCRSConfig,
  transformConstrain?: TransformConstrainFunction
): {
  projection: CustomCRSProjection;
  transform: CustomCRSTransform;
  cameraHelper: ICameraHelper;
}
```

Creates a complete custom CRS projection setup.

### CustomCRSProjection

```typescript
class CustomCRSProjection implements Projection {
  constructor(config: CustomCRSConfig);

  get config(): CustomCRSConfig;
  get proj4Converter(): proj4.Converter;

  transformFromWGS84(lng: number, lat: number): [number, number];
  transformToWGS84(x: number, y: number): [number, number];
  normalizeCoordinates(x: number, y: number): [number, number];
  denormalizeCoordinates(normalizedX: number, normalizedY: number): [number, number];
}
```

### CustomCRSTransform

```typescript
class CustomCRSTransform extends MercatorTransform {
  constructor(projection: CustomCRSProjection, options?: TransformOptions);

  get customProjection(): CustomCRSProjection;

  setCenterInCRS(x: number, y: number): void;
  getCenterInCRS(): [number, number];
  projectCRSToMercator(crsX: number, crsY: number): MercatorCoordinate;
  unprojectMercatorToCRS(mercatorX: number, mercatorY: number): [number, number];
}
```

## Contributing

This is an initial implementation that provides the foundation for custom CRS support. Contributions are welcome to help complete the full implementation! Areas where help is needed:

1. Full Map integration
2. Per-source CRS support
3. Custom shaders for different projection types
4. Performance optimizations
5. Additional examples and documentation
6. Testing

Please see the [Future Work](#-future-work) section for a complete list of tasks.

## References

- [Issue #5764](https://github.com/maplibre/maplibre-gl-js/issues/5764) - Original feature request
- [proj4js](https://github.com/proj4js/proj4js) - JavaScript library for coordinate transformations
- [EPSG.io](https://epsg.io/) - Database of coordinate reference systems
- [OpenLayers](https://openlayers.org/) - Another mapping library with extensive CRS support

## License

This feature is part of MapLibre GL JS and is licensed under the BSD-3-Clause license.
