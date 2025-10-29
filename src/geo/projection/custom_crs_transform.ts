import {MercatorTransform} from './mercator_transform';
import {LngLat, type LngLatLike} from '../lng_lat';
import {MercatorCoordinate} from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import type {CustomCRSProjection} from './custom_crs_projection';
import type {TransformOptions} from '../transform_helper';

/**
 * A transform that extends MercatorTransform to support custom coordinate reference systems.
 *
 * This transform handles coordinate transformations between WGS84, the custom CRS, and screen coordinates.
 * It leverages the existing Mercator rendering pipeline while transforming coordinates through proj4.
 *
 * Note: This is a simplified implementation that works best with planar projections.
 * Full support for all CRS types would require additional work in the rendering pipeline.
 */
export class CustomCRSTransform extends MercatorTransform {
    private _customProjection: CustomCRSProjection;

    constructor(projection: CustomCRSProjection, options?: TransformOptions) {
        super(options);
        this._customProjection = projection;
    }

    /**
     * Get the custom CRS projection instance
     */
    get customProjection(): CustomCRSProjection {
        return this._customProjection;
    }

    /**
     * Convert a geographical coordinate to screen point
     * Overrides the default Mercator implementation to use custom CRS transformation
     */
    locationToScreenPoint(lnglat: LngLat, terrain?: any): Point {
        // Transform from WGS84 to custom CRS
        const [x, y] = this._customProjection.transformFromWGS84(lnglat.lng, lnglat.lat);

        // Normalize to 0-1 range based on CRS bounds
        const [normalizedX, normalizedY] = this._customProjection.normalizeCoordinates(x, y);

        // Create a MercatorCoordinate in the normalized space
        // This allows us to reuse the existing rendering pipeline
        const mercatorCoord = new MercatorCoordinate(normalizedX, normalizedY, 0);

        // Use the parent implementation to convert to screen coordinates
        // coordinatePoint will use the internal _pixelMatrix by default
        return this.coordinatePoint(mercatorCoord, 0);
    }

    /**
     * Convert a screen point to geographical coordinate
     * Overrides the default Mercator implementation to use custom CRS transformation
     */
    screenPointToLocation(p: Point, terrain?: any): LngLat {
        // Use the parent implementation to convert to normalized coordinates
        const mercatorCoord = this.screenPointToMercatorCoordinate(p, terrain);

        // Denormalize from 0-1 range to CRS units
        const [x, y] = this._customProjection.denormalizeCoordinates(
            mercatorCoord.x,
            mercatorCoord.y
        );

        // Transform from custom CRS to WGS84
        const [lng, lat] = this._customProjection.transformToWGS84(x, y);

        return new LngLat(lng, lat);
    }

    /**
     * Set the map center using custom CRS coordinates
     * @param x - X coordinate in the custom CRS
     * @param y - Y coordinate in the custom CRS
     */
    setCenterInCRS(x: number, y: number): void {
        const [lng, lat] = this._customProjection.transformToWGS84(x, y);
        this.setCenter(new LngLat(lng, lat));
    }

    /**
     * Get the map center in custom CRS coordinates
     * @returns [x, y] coordinates in the custom CRS
     */
    getCenterInCRS(): [number, number] {
        const center = this.center;
        return this._customProjection.transformFromWGS84(center.lng, center.lat);
    }

    /**
     * Project a point in the custom CRS to mercator coordinates
     * This allows vector tile coordinates to be interpreted in the custom CRS
     */
    projectCRSToMercator(crsX: number, crsY: number): MercatorCoordinate {
        const [normalizedX, normalizedY] = this._customProjection.normalizeCoordinates(crsX, crsY);
        return new MercatorCoordinate(normalizedX, normalizedY, 0);
    }

    /**
     * Unproject mercator coordinates to the custom CRS
     */
    unprojectMercatorToCRS(mercatorX: number, mercatorY: number): [number, number] {
        return this._customProjection.denormalizeCoordinates(mercatorX, mercatorY);
    }
}
