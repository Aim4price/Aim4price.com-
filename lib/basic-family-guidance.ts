/** Display-only selection help. Never used to assign a family or calculate a price.
 * Size classes overlap between manufacturers, so do not invent hard kW/tonnage
 * boundaries that the reviewed catalogue and its price bands do not define.
 */
const FAMILY_GUIDANCE: Record<string, string> = {
  compact_tractor: 'Small-frame tractor for light work and tight spaces. Compare engine kW/hp and frame size.',
  orchard_vineyard_tractor: 'Narrow or low-profile tractor for orchard and vineyard rows. Check width and clearance.',
  small_field_tractor: 'General farm tractor for lighter fieldwork, mowing and loader work. Compare engine kW/hp and implement size.',
  big_field_tractor: 'Large-frame tractor for heavy cultivation and large implements. Compare engine kW/hp and working size.',
  articulated_tractor: 'Tractor that steers by bending at the centre, typically for heavy fieldwork.',
  small_combine_harvester: 'Lower-capacity combine. Compare crop throughput, header width and grain-tank size.',
  medium_combine_harvester: 'Mid-capacity combine. Compare crop throughput, header width and grain-tank size.',
  large_combine_harvester: 'High-capacity combine for large harvesting workloads. Compare throughput and grain-tank size.',
  grain_cutting_header: 'Cutting header only, not the combine. Compare cutting width and crop suitability.',
  combine_pickup_header: 'Header that picks up an already-cut crop. Excludes the combine itself.',
  forage_crop_cutting_header: 'Cuts standing forage for a forage harvester. Compare working width and crop type.',
  forage_pickup_header: 'Picks up cut forage from windrows. Excludes the forage harvester.',
  small_square_baler: 'Produces smaller rectangular bales. Compare bale dimensions and output.',
  large_square_baler: 'Produces large rectangular bales. Compare bale dimensions and output.',
  round_baler: 'Produces round bales. Compare bale diameter, chamber type and output.',
  baler_wrapper: 'Combined baling and wrapping machine. A separate wrapper has its own category.',
  centre_pivot_irrigator: 'Irrigation spans rotate around a fixed centre. Compare irrigated area and span length.',
  linear_irrigator: 'Irrigation system moves across the field in a straight line.',
  mini_excavator: 'Compact excavator for confined sites. Compare operating weight in tonnes and digging depth.',
  tracked_excavator: 'Conventional crawler excavator. Compare operating weight, reach and bucket capacity.',
  wheeled_excavator: 'Excavator on tyres rather than tracks. Compare operating weight and reach.',
  long_reach_excavator: 'Extended boom for long-distance digging or dredging. Check reach and operating weight.',
  high_reach_demolition_excavator: 'Specialist high-reach demolition machine. Check working height and attachment capacity.',
  backhoe_loader: 'Front loader bucket and rear digging arm on one wheeled machine.',
  compact_wheel_loader: 'Small-frame wheeled loader for confined sites. Compare operating weight and bucket capacity.',
  wheel_loader: 'Full-size wheeled front loader. Compare operating weight and bucket capacity.',
  skid_steer_loader: 'Compact loader on wheels that turns by varying wheel speed on each side.',
  compact_track_loader: 'Compact loader on rubber tracks. Compare rated operating capacity.',
  crawler_loader: 'Tracked front loader for earthmoving. Compare operating weight and bucket capacity.',
  articulated_dump_truck: 'Off-road haul truck with a jointed chassis. Compare rated payload in tonnes.',
  rigid_dump_truck: 'Off-road haul truck with a rigid chassis. Compare rated payload in tonnes.',
  site_dumper: 'Compact site machine with a tipping skip. Compare payload and tipping arrangement.',
  fixed_telehandler: 'Telescopic handler with a fixed upper body. Compare lift capacity and reach.',
  rotating_telehandler: 'Telescopic handler with a rotating upper body. Compare lift capacity and reach.',
  articulated_boom_lift: 'Jointed boom reaches up and over obstacles. Compare working height and outreach.',
  telescopic_boom_lift: 'Straight extending boom for reach. Compare working height and outreach.',
  slab_scissor_lift: 'Vertical lifting platform for firm, level surfaces. Compare working height.',
  rough_terrain_scissor_lift: 'Scissor platform designed for uneven sites. Compare working height and platform load.',
  all_terrain_crane: 'Mobile crane designed for road travel and site work. Compare lifting capacity and boom reach.',
  rough_terrain_crane: 'Crane designed mainly for off-road site work. Compare lifting capacity and boom reach.',
  manual_pallet_jack: 'Hand-pushed pallet mover with manual lifting. It does not stack pallets at height.',
  powered_pallet_truck: 'Powered low-level pallet mover. Choose a stacker for lifting pallets onto racks.',
  manual_pallet_stacker: 'Manually operated pallet stacker. Compare lifting height and rated load.',
  powered_pallet_stacker: 'Powered pallet lifting and stacking. Compare lifting height and rated load.',
  reach_truck: 'Warehouse lift truck with a reaching mast for racking. Compare load and lift height.',
  turret_truck: 'Very-narrow-aisle warehouse truck with a rotating fork assembly.',
  container_reach_stacker: 'Telescopic machine for handling shipping containers. Compare container load capacity.',
  diesel_counterbalance_forklift: 'Diesel-powered forklift. Compare rated lifting tonnes and mast height.',
  gas_counterbalance_forklift: 'Gas- or petrol-powered forklift. Compare rated lifting tonnes and mast height.',
  electric_counterbalance_forklift: 'Battery-powered forklift. Compare lifting tonnes, mast height and battery specification.',
  single_cab_bakkie: 'One row of seats with a separate load bed.',
  extended_cab_bakkie: 'Extra cab space behind the front seats, usually with limited rear seating.',
  double_cab_bakkie: 'Two full seating rows with a separate load bed.',
  compact_panel_van: 'Small enclosed delivery van. Compare load volume and payload.',
  panel_van: 'Enclosed goods van. Compare roof height, wheelbase, load volume and payload.',
  crew_van: 'Van combining rear passenger seats with a goods area.',
  hatchback: 'Passenger car with a rear hatch opening into the luggage area.',
  sedan_fastback: 'Passenger car with a saloon or sloping fastback body. Match the model and specification.',
  station_wagon: 'Passenger car with an extended roof and rear luggage area.',
  suv_crossover: 'SUV or crossover body. Compare size, seating and drivetrain.',
  mpv_people_carrier: 'Passenger-focused vehicle with flexible seating and cabin space.',
  minibus: 'Smaller passenger transport vehicle. Compare registered seat count and body size.',
  midibus: 'Passenger bus between minibus and full-size bus. Compare seat count and body length.',
  commuter_bus: 'Full-size bus for regular passenger routes. Compare seating and passenger capacity.',
  city_bus: 'Urban passenger bus, often with standing space. Compare seating and overall capacity.',
  coach: 'Passenger bus configured for longer journeys, typically with luggage storage.',
  truck_tractor: 'Powered towing unit for a semi-trailer. The trailer is a separate asset.',
  truck_chassis_cab: 'Truck cab and chassis before a specialised load body is fitted.',
  flatbed_truck: 'Truck with an open, flat load deck. Compare payload and deck length.',
  dropside_truck: 'Truck with an open load deck and folding side panels.',
  box_truck: 'Truck with a rigid enclosed goods body.',
  curtainside_truck: 'Truck with flexible side curtains for loading access.',
  refrigerated_truck: 'Truck with an insulated body and refrigeration equipment.',
  tipper_truck: 'Road truck with a tipping body. Compare payload and body capacity.',
  rollback_truck: 'Vehicle transporter with a sliding and tilting load deck.',
  wheel_lift_tow_truck: 'Recovery truck that lifts one end of a vehicle for towing.',
};

type Family = { familyKey: string; familyLabel: string; sectorKey?: string | null };

export function getBasicFamilyGuidance(family: Family): string {
  const key = family.familyKey;
  if (Object.hasOwn(FAMILY_GUIDANCE, key)) return FAMILY_GUIDANCE[key];
  const text = `${key} ${family.familyLabel}`.toLowerCase().replaceAll('_', ' ');
  // Mounting distinctions take priority over generic machinery wording.
  if (/attachment|bucket|loader pallet forks|excavator (grab|ripper)|tractor front loader/.test(text)) return 'Attachment only, not the host machine. Match its size, capacity and compatible machine.';
  if (family.sectorKey === 'agricultural' && /mounted|tractor pto|tractor post.hole/.test(text)) return 'Carried on a tractor or host machine. Compare working width or capacity; the host is separate.';
  if (/trailed|towed/.test(text) && family.sectorKey === 'agricultural') return 'Pulled behind a tractor on its own wheels. Compare working width or capacity; the tractor is separate.';
  if (/header/.test(text)) return 'Harvester attachment only. Compare crop type, working width or row count.';
  if (/boom lift|scissor lift|personnel lift|work platform|aerial platform/.test(text)) return 'Compare working height, outreach, platform load and indoor or outdoor use.';
  if (/forklift|telehandler|hoist|crane|lift table|vehicle lift|chain block|gantry/.test(text)) return 'Compare rated lifting load, lift height and reach, as well as the machine type.';
  if (/generator/.test(text)) return 'Compare rated output in kVA/kW, fuel type and single- or three-phase supply.';
  if (/compressor/.test(text)) return 'Compare delivered airflow and working pressure, plus portable or fixed installation.';
  if (/pump/.test(text)) return 'Compare flow rate, pressure or head, and the material being pumped.';
  if (/tank|sprayer|spraying|spreader|mixer|blender|agitator/.test(text)) return 'Compare tank or batch capacity, working output and fitted equipment.';
  if (family.sectorKey !== 'construction' && /trailer|tow dolly/.test(text)) return 'Trailer only, not the towing vehicle. Compare payload, deck or body size and axle layout.';
  if (family.sectorKey === 'motor' && /truck/.test(text)) return 'Match the truck body and axle layout. Compare rated payload and body capacity.';
  if (/bus|coach/.test(text)) return 'Compare passenger capacity, body layout and intended route or journey type.';
  if (/baler|wrapper/.test(text)) return 'Compare bale size, output and whether baling and wrapping are combined or separate.';
  if (/planter|seed drill|transplanter/.test(text)) return 'Compare row count, row spacing or working width and planting equipment.';
  if (family.sectorKey === 'agricultural' && /mower|mulcher|slasher|rake|tedder|plough|harrow|cultivator|ripper|tiller/.test(text)) return 'Compare working width, number of working units and tractor power requirements.';
  if (/harvester|combine/.test(text)) return 'Compare crop type, harvesting capacity and working width; distinguish the machine from its header.';
  if (family.sectorKey === 'construction' && /roller|compactor|rammer/.test(text)) return 'Compare machine weight, working width and the surface or material it compacts.';
  if (/excavator|loader|dumper|bulldozer|grader/.test(text)) return 'Compare operating weight, load or bucket capacity and the machine configuration.';
  if (/drill|drilling|pile|piling|trencher/.test(text)) return 'Compare working depth, diameter or width and the power or capacity needed for the job.';
  if (/conveyor|elevator/.test(text)) return 'Compare length, lifting height, material capacity and drive type.';
  if (/printer|printing|press|cutter|cutting|lathe|milling|saw|machining/.test(text)) return 'Compare working size, output and manual or automated operation.';
  if (family.sectorKey === 'agricultural') {
    if (/grain|feed|sheller|thresher|mill|auger/.test(text)) return 'Compare material capacity, throughput and the crop or feed being handled.';
    if (/livestock|cattle|sheep|goat/.test(text)) return 'Compare animal size, handling capacity and manual or powered operation.';
    if (/irrigator/.test(text)) return 'Compare irrigated area, hose or span length, flow requirements and movement type.';
    if (/bale/.test(text)) return 'Compare bale size, handling capacity and whether the machine handles, shreds or unrolls bales.';
    if (/milking|calf feeder|incubator/.test(text)) return 'Compare the number of animals or eggs handled and the equipment capacity.';
    if (/digger|lifter|topper|puller|weeder|pruner|leveller|scraper|ridger|aerator/.test(text)) return 'Compare working width, depth or crop-row spacing and required tractor power.';
  }
  if (family.sectorKey === 'industrial') {
    if (/sealer|sealing|packer|packing|filling|filler|bagging|carton|labell|strapping|capping/.test(text)) return 'Compare pack or container size, packs per minute and manual or automatic operation.';
    if (/weld/.test(text)) return 'Compare welding process, rated amperage, duty cycle and power supply.';
    if (/boiler|chiller|heater|cooling|dehumidifier/.test(text)) return 'Compare heating or cooling capacity, operating temperature and installation type.';
    if (/washing|laundry|dry.clean|tumble|ironing/.test(text)) return 'Compare load capacity in kg, cycle output and heating or power requirements.';
    if (/sewing|overlock|embroid/.test(text)) return 'Compare stitch or embroidery function, working area and automation level.';
    if (/tyre changer|wheel balancer|wheel alignment/.test(text)) return 'Compare supported wheel and tyre sizes and passenger or heavy-vehicle capability.';
    if (/scrubber|sweeper|vacuum|cleaner|washer|polisher|blaster/.test(text)) return 'Compare cleaning width or capacity, power source and walk-behind or ride-on operation.';
    if (/grinder|sander|router|planer|moulder|bending|folder|guillotine|boring|edm|ironworker/.test(text)) return 'Compare material type, working dimensions and manual or CNC operation.';
    if (/oven|prover|dough|bakery|bread|pastry/.test(text)) return 'Compare batch size, trays or working width, output and heating requirements.';
    if (/meat|mincer|sausage|slicer|ice machine/.test(text)) return 'Compare batch or hourly output, product size and food-processing function.';
    if (/crusher|shredder|granulator|pulveriser|waste compactor/.test(text)) return 'Compare material type, throughput and feed or chamber size.';
    if (/battery|energy storage/.test(text)) return 'Compare usable storage in kWh, output in kW and included power equipment.';
    if (/lighting/.test(text)) return 'Compare mast height, light output and battery, engine or mains power.';
    if (/air dryer|air blower/.test(text)) return 'Compare airflow, operating pressure and the required air treatment.';
    if (/plant|block machine|block press/.test(text)) return 'Compare hourly production, batch capacity and mobile or fixed installation.';
    if (/plastic|extruder/.test(text)) return 'Compare processing type, product size, output and tooling included.';
  }
  if (family.sectorKey === 'motor' && /motorcycle|bike|scooter|quad|side.by.side|trike/.test(text)) return 'Match road, off-road or utility use. Compare engine size or electric output and rider capacity.';
  if (family.sectorKey === 'motor' && /caravan|camper|motorhome/.test(text)) return 'Compare sleeping layout, body size and road or off-road specification.';
  if (family.sectorKey === 'motor') return 'Match the body style and intended use, then compare size, capacity and specification.';
  if (family.sectorKey === 'industrial') return 'Compare working capacity, output and automation level for an equivalent machine.';
  if (family.sectorKey === 'construction') return 'Compare working size, capacity and configuration for an equivalent machine.';
  return 'Compare working size, capacity and fitted equipment for an equivalent asset.';
}
