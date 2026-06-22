CREATE TABLE sites (
	id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	address TEXT, 
	latitude FLOAT, 
	longitude FLOAT, 
	is_active BOOLEAN, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);
CREATE TABLE users (
	id INTEGER NOT NULL, 
	username VARCHAR(100) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	full_name VARCHAR(255) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	role VARCHAR(50), 
	department VARCHAR(100), 
	is_active BOOLEAN, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	last_login DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);
CREATE UNIQUE INDEX ix_users_username ON users (username);
CREATE TABLE visitors (
	id INTEGER NOT NULL, 
	fullname VARCHAR(255) NOT NULL, 
	passport_number VARCHAR(100), 
	nationality VARCHAR(100), 
	phone_number VARCHAR(50), 
	address TEXT, 
	photo_path VARCHAR(500), 
	face_embedding_id VARCHAR(100), 
	purpose TEXT, 
	notes TEXT, 
	status VARCHAR(11) NOT NULL, 
	enrolled_by VARCHAR(100), 
	approved_by VARCHAR(100), 
	requires_escort BOOLEAN, 
	location VARCHAR(255), 
	entry_time DATETIME, 
	exit_time DATETIME, 
	approver_id VARCHAR(100), 
	department VARCHAR(100), 
	role VARCHAR(50), 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_visitors_status ON visitors (status);
CREATE INDEX ix_visitors_passport_number ON visitors (passport_number);
CREATE TABLE employees (
	id INTEGER NOT NULL, 
	employee_code VARCHAR(100) NOT NULL, 
	fullname VARCHAR(255) NOT NULL, 
	department VARCHAR(100), 
	shift VARCHAR(50), 
	photo_path VARCHAR(500), 
	face_embedding_id VARCHAR(100), 
	break_interval_minutes INTEGER, 
	break_duration_minutes INTEGER, 
	is_active BOOLEAN, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_employees_employee_code ON employees (employee_code);
CREATE TABLE buildings (
	id INTEGER NOT NULL, 
	site_id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	building_type VARCHAR(7) NOT NULL, 
	description TEXT, 
	x_position FLOAT, 
	y_position FLOAT, 
	map_width FLOAT, 
	map_height FLOAT, 
	is_active BOOLEAN, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);
CREATE INDEX ix_buildings_site_id ON buildings (site_id);
CREATE TABLE floors (
	id INTEGER NOT NULL, 
	building_id INTEGER NOT NULL, 
	level INTEGER NOT NULL, 
	label VARCHAR(100) NOT NULL, 
	sort_order INTEGER, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(building_id) REFERENCES buildings (id) ON DELETE CASCADE
);
CREATE INDEX ix_floors_building_id ON floors (building_id);
CREATE TABLE cameras (
	id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	rtsp_url VARCHAR(500) NOT NULL, 
	location VARCHAR(255), 
	description TEXT, 
	floor INTEGER NOT NULL, 
	building_id INTEGER, 
	x_coord FLOAT, 
	y_coord FLOAT, 
	angle FLOAT, 
	fov FLOAT, 
	status VARCHAR(11) NOT NULL, 
	is_overhead BOOLEAN, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(building_id) REFERENCES buildings (id) ON DELETE SET NULL
);
CREATE INDEX ix_cameras_building_id ON cameras (building_id);
CREATE INDEX ix_cameras_floor ON cameras (floor);
CREATE INDEX ix_cameras_status ON cameras (status);
CREATE TABLE layouts (
	id INTEGER NOT NULL, 
	floor_num INTEGER NOT NULL, 
	building_id INTEGER, 
	name VARCHAR(255), 
	image_path VARCHAR(500) NOT NULL, 
	width INTEGER, 
	height INTEGER, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_layout_building_floor UNIQUE (building_id, floor_num), 
	FOREIGN KEY(building_id) REFERENCES buildings (id) ON DELETE SET NULL
);
CREATE INDEX ix_layouts_building_id ON layouts (building_id);
CREATE INDEX ix_layouts_floor_num ON layouts (floor_num);
CREATE TABLE zones (
	id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	floor INTEGER NOT NULL, 
	building_id INTEGER, 
	coordinates JSON NOT NULL, 
	zone_type VARCHAR(10) NOT NULL, 
	dwell_alert_seconds INTEGER, 
	color VARCHAR(20), 
	is_active BOOLEAN, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(building_id) REFERENCES buildings (id) ON DELETE SET NULL
);
CREATE INDEX ix_zones_building_id ON zones (building_id);
CREATE INDEX ix_zones_floor ON zones (floor);
CREATE TABLE employee_breaks (
	id INTEGER NOT NULL, 
	employee_id INTEGER NOT NULL, 
	start_time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	end_time DATETIME, 
	duration_seconds INTEGER, 
	compliant BOOLEAN, 
	lounge_zone_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(lounge_zone_id) REFERENCES zones (id)
);
CREATE INDEX ix_employee_breaks_employee_id ON employee_breaks (employee_id);
CREATE INDEX ix_employee_breaks_start_time ON employee_breaks (start_time);
CREATE TABLE active_tracks (
	id VARCHAR(100) NOT NULL, 
	camera_id INTEGER, 
	global_id VARCHAR(100) NOT NULL, 
	local_track_id INTEGER, 
	first_seen DATETIME DEFAULT CURRENT_TIMESTAMP, 
	last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, 
	last_x FLOAT, 
	last_y FLOAT, 
	is_active BOOLEAN, 
	matched_visitor_id INTEGER, 
	matched_employee_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(camera_id) REFERENCES cameras (id) ON DELETE SET NULL, 
	FOREIGN KEY(matched_visitor_id) REFERENCES visitors (id), 
	FOREIGN KEY(matched_employee_id) REFERENCES employees (id)
);
CREATE INDEX ix_active_tracks_global_id ON active_tracks (global_id);
CREATE INDEX ix_active_tracks_is_active ON active_tracks (is_active);
CREATE TABLE alerts (
	id INTEGER NOT NULL, 
	camera_id INTEGER, 
	track_id VARCHAR(100), 
	global_id VARCHAR(100), 
	alert_type VARCHAR(15) NOT NULL, 
	description TEXT, 
	severity VARCHAR(8) NOT NULL, 
	zone_id INTEGER, 
	snapshot_path VARCHAR(500), 
	timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
	acknowledged BOOLEAN, 
	acknowledged_by VARCHAR(100), 
	acknowledged_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(camera_id) REFERENCES cameras (id) ON DELETE SET NULL, 
	FOREIGN KEY(zone_id) REFERENCES zones (id)
);
CREATE INDEX ix_alerts_track_id ON alerts (track_id);
CREATE INDEX ix_alerts_acknowledged ON alerts (acknowledged);
CREATE INDEX ix_alerts_timestamp ON alerts (timestamp);
CREATE INDEX ix_alerts_severity ON alerts (severity);
CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
