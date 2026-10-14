/** Display-only selection help. Never used to assign a family or calculate a price.
 * Size classes overlap between manufacturers, so do not invent hard kW/tonnage
 * boundaries that the reviewed catalogue and its price bands do not define.
 */
const FAMILY_GUIDANCE: Record<string, string> = {
  self_propelled_windrower: "Cuts crops into windrows. Compare cutting width, crop suitability and fitted header.",
  plastic_mulch_layer: "Lays plastic mulch over crop beds. Compare bed width and included laying equipment.",
  land_roller: "Rolls agricultural land. Compare working width, roller design and weight.",
  rock_picker: "Collects stones from fields. Compare picking width, stone size and hopper capacity.",
  engine_wood_chipper: "Chips branches and wood. Compare feed opening, output and engine or tractor drive.",
  pto_wood_chipper: "Chips branches and wood. Compare feed opening, output and engine or tractor drive.",
  orchard_platform: "Work platform for orchard tasks. Compare platform height, capacity and drive type.",
  self_loading_forage_wagon: "Collects and carries cut forage. Compare load capacity and pickup equipment.",
  seed_fertiliser_tender: "Transfers seed or fertiliser to field equipment. Compare storage and transfer capacity.",
  crop_washer: "Washes harvested produce. Compare crop suitability, handling capacity and cleaning system.",
  skid_firefighting_unit: "Removable firefighting unit. Compare tank, pump and hose equipment; the carrying vehicle is separate.",
  crop_application_drone: "Drone for applying crop inputs. Compare payload, application equipment and included batteries.",
  cane_loader: "Loads harvested cane. Compare lifting capacity, reach and loading attachment.",
  tracked_dump_carrier: "Tracked carrier for site loads. Compare payload, body capacity and tipping arrangement.",
  tracked_site_dumper: "Tracked carrier for site loads. Compare payload, body capacity and tipping arrangement.",
  tracked_asphalt_paver: "Lays asphalt on roads or paved areas. Compare paving width, output and screed equipment.",
  wheeled_asphalt_paver: "Lays asphalt on roads or paved areas. Compare paving width, output and screed equipment.",
  road_recycler_stabiliser: "Processes road or soil layers. Compare working width, depth and drive arrangement.",
  tractor_soil_stabiliser: "Processes road or soil layers. Compare working width, depth and drive arrangement.",
  asphalt_material_feeder: "Transfers asphalt to a paver. Compare throughput, hopper capacity and conveyor reach.",
  concrete_kerb_paver: "Forms concrete kerbs or paving. Compare profile, paving width and production capacity.",
  concrete_road_paver: "Forms concrete kerbs or paving. Compare profile, paving width and production capacity.",
  walk_behind_line_marker: "Applies surface markings. Compare line width, paint capacity and drive type.",
  ride_on_line_marker: "Applies surface markings. Compare line width, paint capacity and drive type.",
  concrete_placing_boom: "Positions pumped concrete. Compare boom reach and mounting arrangement; check what equipment is included.",
  shotcrete_machine: "Sprays concrete or mortar. Compare output, application system and included equipment.",
  concrete_poker_vibrator: "Compacts freshly poured concrete. Compare poker size, drive type and included shafts.",
  powered_concrete_screed: "Levels fresh concrete. Compare working width, controls and drive arrangement.",
  laser_concrete_screed: "Levels fresh concrete. Compare working width, controls and drive arrangement.",
  walk_behind_power_float: "Finishes concrete surfaces. Compare finishing width, rotor layout and drive type.",
  ride_on_power_float: "Finishes concrete surfaces. Compare finishing width, rotor layout and drive type.",
  vacuum_excavation_unit: "Removes soil using suction. Compare vacuum output, tank capacity and whether a vehicle is included.",
  truck_vacuum_excavator: "Removes soil using suction. Compare vacuum output, tank capacity and whether a vehicle is included.",
  mobile_scaffold_tower: "Moveable scaffold for access work. Compare platform height, size and included sections.",
  concrete_pulveriser: "Demolition attachment. Compare jaw size and host-machine compatibility; the host is separate.",
  demolition_cutter: "Demolition attachment. Compare jaw size and host-machine compatibility; the host is separate.",
  mobile_jaw_crusher: "Mobile crushing machine. Compare material type, feed size and processing output.",
  mobile_cone_crusher: "Mobile crushing machine. Compare material type, feed size and processing output.",
  mobile_impact_crusher: "Mobile crushing machine. Compare material type, feed size and processing output.",
  mobile_screen: "Mobile material screening machine. Compare screen size, material suitability and output.",
  mobile_trommel: "Mobile material screening machine. Compare screen size, material suitability and output.",
  demolition_robot: "Remote-controlled demolition machine. Compare reach, power and included attachments.",
  electric_demolition_hammer: "Handheld breaking tool. Compare impact performance, weight, power source and included tools.",
  pneumatic_breaker: "Handheld breaking tool. Compare impact performance, weight, power source and included tools.",
  hydraulic_handheld_breaker: "Handheld breaking tool. Compare impact performance, weight, power source and included tools.",
  petrol_breaker: "Handheld breaking tool. Compare impact performance, weight, power source and included tools.",
  floor_grinder: "Prepares or removes floor surfaces. Compare working width, removal method and power source.",
  floor_scarifier: "Prepares or removes floor surfaces. Compare working width, removal method and power source.",
  floor_shot_blaster: "Prepares or removes floor surfaces. Compare working width, removal method and power source.",
  walk_behind_floor_scraper: "Prepares or removes floor surfaces. Compare working width, removal method and power source.",
  ride_on_floor_scraper: "Prepares or removes floor surfaces. Compare working width, removal method and power source.",
  rebar_bender: "Cuts or bends reinforcing steel. Compare bar diameter, functions and powered or manual operation.",
  rebar_cutter: "Cuts or bends reinforcing steel. Compare bar diameter, functions and powered or manual operation.",
  rebar_cutter_bender: "Cuts or bends reinforcing steel. Compare bar diameter, functions and powered or manual operation.",
  manual_total_station: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  robotic_total_station: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  survey_gnss_rover: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  dumpy_level: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  digital_survey_level: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  construction_laser_level: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  pipe_laser: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  theodolite: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  survey_laser_scanner: "Survey or setting-out equipment. Compare measurement function, accuracy and included accessories.",
  drum_lifter_tipper: "Lifts or tips drums. Compare drum compatibility, rated load and lifting height.",
  order_picker: "Warehouse equipment for picking stock. Compare picking height, load capacity and operator position.",
  pallet_inverter: "Turns palletised loads. Compare load capacity, pallet size and turning arrangement.",
  warehouse_tow_tractor: "Tows loads within a warehouse or site. Compare towing capacity and battery specification.",
  dock_leveller: "Bridges loading docks and vehicles. Compare platform dimensions, rated load and operation.",
  wheelie_bin_compactor: "Compacts waste in bins. Compare bin compatibility, compaction force and power supply.",
  hydraulic_power_pack: "Supplies hydraulic power. Compare flow, operating pressure and drive type.",
  water_booster_set: "Boosts water-supply pressure. Compare flow, pressure and included pumps and controls.",
  carpet_extractor: "Washes and extracts moisture from carpets. Compare tank capacity, extraction performance and accessories.",
  pipe_threading_machine: "Threads pipes. Compare pipe diameter, thread types and included dies.",
  plate_roller: "Rolls metal plate or sections. Compare material dimensions, thickness and rolling capacity.",
  section_roller: "Rolls metal plate or sections. Compare material dimensions, thickness and rolling capacity.",
  combination_woodworking_machine: "Woodworking equipment. Match its functions, workpiece dimensions and manual or automatic operation.",
  edgebander: "Woodworking equipment. Match its functions, workpiece dimensions and manual or automatic operation.",
  wood_morticer: "Woodworking equipment. Match its functions, workpiece dimensions and manual or automatic operation.",
  wood_tenoner: "Woodworking equipment. Match its functions, workpiece dimensions and manual or automatic operation.",
  wood_thicknesser: "Woodworking equipment. Match its functions, workpiece dimensions and manual or automatic operation.",
  wood_dust_extractor: "Collects woodworking dust. Compare airflow, filtration and collection capacity.",
  vehicle_diagnostic_scanner: "Vehicle diagnostic equipment. Compare vehicle coverage, supported functions and included software.",
  industrial_coverstitch_machine: "Sews coverstitch seams. Compare stitch configuration, material suitability and automation.",
  booklet_maker: "Print-finishing equipment. Match the finishing function, sheet or roll size and output.",
  paper_creaser: "Print-finishing equipment. Match the finishing function, sheet or roll size and output.",
  roll_laminator: "Print-finishing equipment. Match the finishing function, sheet or roll size and output.",
  decanter_centrifuge: "Separates materials by spinning. Compare feed material, throughput and separation requirements.",
  high_speed_disperser: "Disperses materials into a liquid. Compare batch capacity, motor power and mixing equipment.",
  air_receiver: "Stores compressed air. Compare vessel capacity, pressure rating and included fittings.",
  industrial_vacuum_pump: "Produces a vacuum. Compare suction flow, vacuum level and process suitability.",
  liquid_ring_vacuum_pump: "Produces a vacuum. Compare suction flow, vacuum level and process suitability.",
  cold_water_pressure_washer: "Cleans with pressurised water. Compare flow, pressure, heating and included accessories.",
  hot_water_pressure_washer: "Cleans with pressurised water. Compare flow, pressure, heating and included accessories.",
  parts_washer: "Cleans mechanical parts. Compare working space, cleaning method and fluid system.",
  dry_ice_blaster: "Cleans using dry ice. Compare delivery capacity, air requirements and included equipment.",
  bread_slicer: "Slices bread loaves. Compare loaf size, slice thickness and output.",
  coupe: "Passenger car with a coupe body. Compare model, seating and specification.",
  convertible: "Passenger car with an opening roof. Compare model, roof system and specification.",
  compact_street_sweeper: "Compact vehicle for sweeping streets. Compare cleaning width, hopper capacity and fitted equipment.",
  fire_engine: "Specialist firefighting vehicle. Compare chassis, pumping or access equipment and what is included.",
  bush_fire_vehicle: "Specialist firefighting vehicle. Compare chassis, pumping or access equipment and what is included.",
  airport_fire_vehicle: "Specialist firefighting vehicle. Compare chassis, pumping or access equipment and what is included.",
  aerial_fire_appliance: "Specialist firefighting vehicle. Compare chassis, pumping or access equipment and what is included.",
  refrigerated_van: "Van with insulated load space and cooling equipment. Compare payload, load volume and refrigeration.",
  ambulance: "Vehicle fitted for patient transport. Compare vehicle specification and included medical equipment.",
  hearse: "Vehicle adapted for funeral transport. Compare vehicle specification, body conversion and fittings.",
  golf_cart: "Small passenger or utility cart. Compare seating or payload, power source and battery specification.",
  passenger_shuttle_cart: "Small passenger or utility cart. Compare seating or payload, power source and battery specification.",
  utility_cargo_cart: "Small passenger or utility cart. Compare seating or payload, power source and battery specification.",
  passenger_tuk_tuk: "Three-wheeled transport vehicle. Compare passenger or cargo capacity and power source.",
  cargo_three_wheeler: "Three-wheeled transport vehicle. Compare passenger or cargo capacity and power source.",
  game_viewer: "Vehicle adapted for game viewing. Compare seating, drivetrain and included conversion equipment.",
  crop_grader: 'Grades produce by size or quality. Compare crop type, sorting capacity and output.',
  livestock_self_feeder: 'Livestock feed storage and dispensing. Compare animal type and feed capacity.',
  automatic_calf_feeder: 'Automated calf feeding. Compare calf capacity, feeding stations and control equipment.',
  nitrogen_generator: 'Produces nitrogen gas. Compare gas purity, flow rate and operating pressure.',
  oxygen_generator: 'Produces oxygen gas. Compare gas purity, flow rate and operating pressure.',
  vehicle_aircon_service_machine: 'Vehicle air-conditioning service unit. Compare refrigerant compatibility and service functions.',
  dough_moulder: 'Shapes dough for bakery production. Compare dough-piece size and hourly output.',
  extrusion_blow_moulder: 'Blow moulds hollow plastic products. Compare product size, output and tooling.',
  battery_solar_lighting_tower: 'Battery or solar-powered lighting. Compare mast height, light output and operating duration.',
  manual_sausage_filler: 'Hand-operated sausage filling. Compare cylinder capacity and product size.',
  powered_sausage_filler: 'Powered sausage filling. Compare batch capacity and hourly output.',
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

const SIZE_CLASS_FAMILIES = new Set([
  'compact_tractor', 'small_field_tractor', 'big_field_tractor',
  'small_combine_harvester', 'medium_combine_harvester', 'large_combine_harvester',
  'mini_excavator', 'compact_wheel_loader', 'wheel_loader', 'stand_on_mini_loader',
  'compact_panel_van', 'panel_van', 'minibus', 'midibus',
]);

type Family = { familyKey: string; familyLabel: string; sectorKey?: string | null };

export function getBasicFamilyGuidance(family: Family): string {
  const key = family.familyKey;
  if (Object.hasOwn(FAMILY_GUIDANCE, key)) return FAMILY_GUIDANCE[key];
  const text = `${key} ${family.familyLabel}`.toLowerCase().replaceAll('_', ' ');
  // Mounting distinctions take priority over generic machinery wording.
  if (family.sectorKey !== 'industrial' && /attachment|bucket|loader pallet forks|excavator (grab|ripper)|tractor front loader/.test(text)) return 'Attachment only, not the host machine. Match its size, capacity and compatible machine.';
  if (family.sectorKey === 'agricultural' && /mounted|tractor pto|tractor post.hole/.test(text)) return 'Carried on a tractor or host machine. Compare working width or capacity; the host is separate.';
  if (/trailed|towed/.test(text) && family.sectorKey === 'agricultural') return 'Pulled behind a tractor on its own wheels. Compare working width or capacity; the tractor is separate.';
  if (/header/.test(text)) return 'Harvester attachment only. Compare crop type, working width or row count.';
  if (/boom lift|scissor lift|personnel lift|work platform|aerial platform/.test(text)) return 'Compare working height, outreach, platform load and indoor or outdoor use.';
  if (/forklift|telehandler|hoist|crane|lift table|vehicle lift|chain block|gantry/.test(text)) return 'Compare rated lifting load, lift height and reach, as well as the machine type.';
  if (/generator/.test(text)) return 'Compare rated output in kVA/kW, fuel type and single- or three-phase supply.';
  if (/compressor/.test(text)) return 'Compare delivered airflow and working pressure, plus portable or fixed installation.';
  if (/pump/.test(text)) return 'Compare flow rate, pressure or head, and the material being pumped.';
  if (family.sectorKey === 'motor' && /trailer|tow dolly/.test(text)) return 'Trailer only; the towing vehicle is separate. Compare load capacity, body type and fitted equipment.';
  if (/tank|sprayer|spraying|spreader|mixer|blender|agitator/.test(text)) return 'Compare tank or batch capacity, working output and fitted equipment.';
  if (family.sectorKey !== 'construction' && /trailer|tow dolly/.test(text)) return 'Trailer only, not the towing vehicle. Compare payload, deck or body size and axle layout.';
  if (family.sectorKey === 'motor' && /truck/.test(text)) return 'Match the truck body and axle layout. Compare rated payload and body capacity.';
  if (/\bbus\b|coach/.test(text)) return 'Compare passenger capacity, body layout and intended route or journey type.';
  if (family.sectorKey === 'agricultural' && /baler|wrapper/.test(text)) return 'Compare bale size, output and whether baling and wrapping are combined or separate.';
  if (/planter|seed drill|transplanter/.test(text)) return 'Compare row count, row spacing or working width and planting equipment.';
  if (family.sectorKey === 'agricultural' && /mower|mulcher|slasher|rake|tedder|plough|harrow|cultivator|ripper|tiller/.test(text)) return 'Compare working width, number of working units and tractor power requirements.';
  if (/harvester|combine/.test(text)) return 'Compare crop type, harvesting capacity and working width; distinguish the machine from its header.';
  if (family.sectorKey === 'construction' && /roller|compactor|rammer/.test(text)) return 'Compare machine weight, working width and the surface or material it compacts.';
  if (/excavator|loader|dumper|bulldozer|grader/.test(text)) return 'Compare operating weight, load or bucket capacity and the machine configuration.';
  if (/drill|drilling|pile|piling|trencher/.test(text)) return 'Compare working depth, diameter or width and the power or capacity needed for the job.';
  if (/conveyor|elevator/.test(text)) return 'Compare length, lifting height, material capacity and drive type.';
  if (/printer|printing|\bpress\b|cutter|cutting|lathe|milling|saw|machining/.test(text)) return 'Compare working size, output and manual or automated operation.';
  if (family.sectorKey === 'agricultural') {
    if (/grain|feed|sheller|thresher|mill|auger/.test(text)) return 'Compare material capacity, throughput and the crop or feed being handled.';
    if (/livestock|cattle|sheep|goat/.test(text)) return 'Compare animal size, handling capacity and manual or powered operation.';
    if (/irrigator/.test(text)) return 'Compare irrigated area, hose or span length, flow requirements and movement type.';
    if (/bale/.test(text)) return 'Compare bale size, handling capacity and whether the machine handles, shreds or unrolls bales.';
    if (/milking|calf feeder|incubator/.test(text)) return 'Compare the number of animals or eggs handled and the equipment capacity.';
    if (/digger|lifter|topper|puller|weeder|pruner|leveller|scraper|ridger|aerator/.test(text)) return 'Compare working width, depth or crop-row spacing and required tractor power.';
  }
  if (family.sectorKey === 'industrial') {
    if (/wrapper|sealer|sealing|packer|packing|filling|filler|bagging|carton|labell|strapping|capping/.test(text)) return 'Compare pack or container size, packs per minute and manual or automatic operation.';
    if (/weld/.test(text)) return 'Compare welding process, rated amperage, duty cycle and power supply.';
    if (/boiler|chiller|heater|cooling|dehumidifier/.test(text)) return 'Compare heating or cooling capacity, operating temperature and installation type.';
    if (/washing|laundry|dry.clean|tumble dryer|ironing/.test(text)) return 'Compare load capacity in kg, cycle output and heating or power requirements.';
    if (/sewing|overlock|embroid/.test(text)) return 'Compare stitch or embroidery function, working area and automation level.';
    if (/tyre changer|wheel balancer|wheel alignment/.test(text)) return 'Compare supported wheel and tyre sizes and passenger or heavy-vehicle capability.';
    if (/scrubber|sweeper|vacuum|cleaner|washer|polisher|blaster/.test(text)) return 'Compare cleaning width or capacity, power source and walk-behind or ride-on operation.';
    if (/grinder|sander|router|planer|moulder|bending|folder|guillotine|boring|edm|ironworker/.test(text)) return 'Compare material type, working dimensions and manual or CNC operation.';
    if (/oven|prover|dough|bakery|bread|pastry/.test(text)) return 'Compare batch size, trays or working width, output and heating requirements.';
    if (/meat|mincer|sausage|slicer|\bice machine/.test(text)) return 'Compare batch or hourly output, product size and food-processing function.';
    if (/baler|crusher|shredder|granulator|pulveriser|waste compactor/.test(text)) return 'Compare material type, throughput and feed or chamber size.';
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


/** Short context beneath each option; does not define price bounds or size cut-offs. */
export function getBasicFamilyGuideNote(family: Family): string {
  return SIZE_CLASS_FAMILIES.has(family.familyKey)
    ? 'Sizes overlap. Adjust the price guide for your asset.'
    : 'Starting price guide only. Adjust it for your asset.';
}
