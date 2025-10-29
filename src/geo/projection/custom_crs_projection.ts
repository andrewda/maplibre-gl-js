import type {Projection, ProjectionGPUContext, TileMeshUsage} from './projection';
import type {CanonicalTileID} from '../../source/tile_id';
import {EXTENT} from '../../data/extent';
import {type PreparedShader, shaders} from '../../shaders/shaders';
import type {Context} from '../../gl/context';
import {Mesh} from '../../render/mesh';
import {PosArray, TriangleIndexArray} from '../../data/array_types.g';
import {SegmentVector} from '../../data/segment';
import posAttributes from '../../data/pos_attributes';
import {SubdivisionGranularitySetting, SubdivisionGranularityExpression} from '../../render/subdivision_granularity_settings';
import proj4 from 'proj4';

export const CustomCRSShaderDefine = '#define PROJECTION_CUSTOM_CRS';
export const CustomCRSShaderVariantKey = 'custom-crs';

/**
 * Configuration for a custom CRS projection
 */
export interface CustomCRSConfig {
    /**
     * The EPSG code or proj4 definition string for the CRS
     * @example 'EPSG:2193' or '+proj=tmerc +lat_0=-90 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
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

/**
 * A projection implementation that supports arbitrary coordinate reference systems (CRS)
 * using the proj4 library for coordinate transformations.
 *
 * This allows rendering vector tiles in their native CRS without converting to Web Mercator.
 *
 * @example
 * ```typescript
 * // New Zealand Transverse Mercator 2000 (EPSG:2193)
 * const nztmProjection = new CustomCRSProjection({
 *   code: 'EPSG:2193',
 *   definition: '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
 *   bounds: [274000, 3087000, 3327000, 7173000] // NZTM bounds
 * });
 * ```
 */
export class CustomCRSProjection implements Projection {
    private _cachedMesh: Mesh = null;
    private _config: CustomCRSConfig;
    private _proj4Instance: proj4.Converter;

    constructor(config: CustomCRSConfig) {
        this._config = config;

        // Register the CRS definition if provided
        if (config.definition) {
            proj4.defs(config.code, config.definition);
        }

        // Create a converter from WGS84 to the target CRS
        try {
            // Explicitly cast to string parameters to match the correct overload
            this._proj4Instance = proj4('WGS84' as string, config.code as string);
        } catch (error) {
            throw new Error(`Failed to initialize proj4 for CRS ${config.code}: ${error.message}`);
        }
    }

    get name(): 'mercator' {
        // For now, we return 'mercator' to maintain compatibility
        // In a full implementation, this would be a new type
        return 'mercator';
    }

    get useSubdivision(): boolean {
        return this._config.useSubdivision || false;
    }

    get shaderVariantName(): string {
        return CustomCRSShaderVariantKey;
    }

    get shaderDefine(): string {
        return CustomCRSShaderDefine;
    }

    get shaderPreludeCode(): PreparedShader {
        // For now, use mercator shaders as a fallback
        // In a full implementation, we would have custom shaders
        return shaders.projectionMercator;
    }

    get vertexShaderPreludeCode(): string {
        return shaders.projectionMercator.vertexSource;
    }

    get subdivisionGranularity(): SubdivisionGranularitySetting {
        if (this._config.useSubdivision) {
            // Use moderate subdivision for custom projections
            const fillLine = new SubdivisionGranularityExpression(256, 2);
            const tileStencil = new SubdivisionGranularityExpression(512, 2);
            return new SubdivisionGranularitySetting({
                fill: fillLine,
                line: fillLine,
                tile: tileStencil,
                stencil: tileStencil,
                circle: 5
            });
        }
        return SubdivisionGranularitySetting.noSubdivision;
    }

    get transitionState(): number {
        return 0;
    }

    get latitudeErrorCorrectionRadians(): number {
        return 0;
    }

    /**
     * Get the CRS configuration
     */
    get config(): CustomCRSConfig {
        return this._config;
    }

    /**
     * Get the proj4 converter instance
     */
    get proj4Converter(): proj4.Converter {
        return this._proj4Instance;
    }

    /**
     * Transform a point from WGS84 (longitude, latitude) to the custom CRS
     * @param lng - Longitude in degrees
     * @param lat - Latitude in degrees
     * @returns Coordinates in the custom CRS [x, y]
     */
    public transformFromWGS84(lng: number, lat: number): [number, number] {
        const result = this._proj4Instance.forward([lng, lat]);
        return [result[0], result[1]];
    }

    /**
     * Transform a point from the custom CRS to WGS84 (longitude, latitude)
     * @param x - X coordinate in the custom CRS
     * @param y - Y coordinate in the custom CRS
     * @returns [longitude, latitude] in degrees
     */
    public transformToWGS84(x: number, y: number): [number, number] {
        const result = this._proj4Instance.inverse([x, y]);
        return [result[0], result[1]];
    }

    /**
     * Normalize coordinates from CRS units to 0-1 range based on the configured bounds
     */
    public normalizeCoordinates(x: number, y: number): [number, number] {
        const [minX, minY, maxX, maxY] = this._config.bounds;
        const normalizedX = (x - minX) / (maxX - minX);
        const normalizedY = (y - minY) / (maxY - minY);
        return [normalizedX, normalizedY];
    }

    /**
     * Denormalize coordinates from 0-1 range to CRS units based on the configured bounds
     */
    public denormalizeCoordinates(normalizedX: number, normalizedY: number): [number, number] {
        const [minX, minY, maxX, maxY] = this._config.bounds;
        const x = normalizedX * (maxX - minX) + minX;
        const y = normalizedY * (maxY - minY) + minY;
        return [x, y];
    }

    public destroy(): void {
        // Clean up resources
        this._cachedMesh = null;
    }

    public updateGPUdependent(_: ProjectionGPUContext): void {
        // No GPU-dependent updates needed for basic custom CRS
    }

    public getMeshFromTileID(context: Context, _tileID: CanonicalTileID, _hasBorder: boolean, _allowPoles: boolean, _usage: TileMeshUsage): Mesh {
        if (this._cachedMesh) {
            return this._cachedMesh;
        }

        // Create a simple quad mesh for the tile
        // If subdivision is enabled, a more complex mesh would be generated
        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        const tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
        const tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const quadTriangleIndices = new TriangleIndexArray();
        quadTriangleIndices.emplaceBack(1, 0, 2);
        quadTriangleIndices.emplaceBack(1, 2, 3);
        const quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);

        this._cachedMesh = new Mesh(tileExtentBuffer, quadTriangleIndexBuffer, tileExtentSegments);
        return this._cachedMesh;
    }

    public recalculate(): void {
        // No recalculation needed for basic custom CRS
    }

    public hasTransition(): boolean {
        return false;
    }

    setErrorQueryLatitudeDegrees(_value: number) {
        // Not applicable for custom CRS
    }
}
