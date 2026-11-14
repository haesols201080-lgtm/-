// Imported hardware models used to live here (an antenna re-encoded from the
// agency's public 3D library). Every building is now modelled procedurally
// in the agency's design language (nasakit.js), so nothing is embedded and
// the table stays empty; ModelBuilder.asset() still reads from it.
export const ASSETS = {};   // name -> { groups: [{ geo, material }], box: Box3 }

export async function loadAssets() {}
