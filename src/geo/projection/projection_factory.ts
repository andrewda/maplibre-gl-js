import {warnOnce} from '../../util/util';
import {MercatorProjection} from './mercator_projection';
import {MercatorTransform} from './mercator_transform';
import {MercatorCameraHelper} from './mercator_camera_helper';
import {GlobeProjection} from './globe_projection';
import {GlobeTransform} from './globe_transform';
import {GlobeCameraHelper} from './globe_camera_helper';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform';
import {VerticalPerspectiveProjection} from './vertical_perspective_projection';
import {CustomCRSProjection, type CustomCRSConfig} from './custom_crs_projection';
import {CustomCRSTransform} from './custom_crs_transform';

import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Projection} from './projection';
import type {ITransform, TransformConstrainFunction} from '../transform_interface';
import type {ICameraHelper} from './camera_helper';

export function createProjectionFromName(name: ProjectionSpecification['type'], transformConstrain?: TransformConstrainFunction): {
    projection: Projection;
    transform: ITransform;
    cameraHelper: ICameraHelper;
} {
    const transformOptions = {constrain: transformConstrain};
    if (Array.isArray(name)) {
        const globeProjection = new GlobeProjection({type: name});
        return {
            projection: globeProjection,
            transform: new GlobeTransform(transformOptions),
            cameraHelper: new GlobeCameraHelper(globeProjection),
        };
    }
    switch (name) {
        case 'mercator':
        {
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(transformOptions),
                cameraHelper: new MercatorCameraHelper(),
            };
        }
        case 'globe':
        {
            const globeProjection = new GlobeProjection({type: [
                'interpolate',
                ['linear'],
                ['zoom'],
                11,
                'vertical-perspective',
                12,
                'mercator'
            ]});
            return {
                projection: globeProjection,
                transform: new GlobeTransform(transformOptions),
                cameraHelper: new GlobeCameraHelper(globeProjection),
            };
        }
        case 'vertical-perspective':
        {
            return {
                projection: new VerticalPerspectiveProjection(),
                transform: new VerticalPerspectiveTransform(transformOptions),
                cameraHelper: new VerticalPerspectiveCameraHelper(),
            };
        }
        default:
        {
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(transformOptions),
                cameraHelper: new MercatorCameraHelper(),
            };
        }
    }
}

/**
 * Create a projection with a custom coordinate reference system.
 *
 * This function creates a projection that supports arbitrary CRS using the proj4 library.
 *
 * @param config - Configuration for the custom CRS
 * @param transformConstrain - Optional transform constraint function
 * @returns An object containing the projection, transform, and camera helper
 *
 * @example
 * ```typescript
 * // Create a projection for New Zealand Transverse Mercator 2000 (EPSG:2193)
 * const {projection, transform, cameraHelper} = createCustomCRSProjection({
 *   code: 'EPSG:2193',
 *   definition: '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
 *   bounds: [274000, 3087000, 3327000, 7173000]
 * });
 * ```
 */
export function createCustomCRSProjection(config: CustomCRSConfig, transformConstrain?: TransformConstrainFunction): {
    projection: CustomCRSProjection;
    transform: CustomCRSTransform;
    cameraHelper: ICameraHelper;
} {
    const transformOptions = {constrain: transformConstrain};
    const projection = new CustomCRSProjection(config);
    return {
        projection,
        transform: new CustomCRSTransform(projection, transformOptions),
        cameraHelper: new MercatorCameraHelper(), // Use Mercator camera helper for planar projections
    };
}
