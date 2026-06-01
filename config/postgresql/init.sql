-- Initial PostgreSQL initialization schema
CREATE TABLE IF NOT EXISTS cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rtsp_url VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    floor INT DEFAULT 1,
    x_coord FLOAT DEFAULT 0.0,
    y_coord FLOAT DEFAULT 0.0,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(255) NOT NULL,
    passport_number VARCHAR(100),
    nationality VARCHAR(100),
    photo_path VARCHAR(255),
    status VARCHAR(50) DEFAULT 'WHITELISTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(100) UNIQUE NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    break_allowed_minutes INT DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS active_tracks (
    id VARCHAR(100) PRIMARY KEY,
    camera_id INT REFERENCES cameras(id),
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    global_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    floor INT DEFAULT 1,
    coordinates JSONB,
    type VARCHAR(50) DEFAULT 'DWELL'
);

CREATE TABLE IF NOT EXISTS employee_breaks (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INT,
    compliant BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    camera_id INT REFERENCES cameras(id),
    track_id VARCHAR(100),
    alert_type VARCHAR(100) NOT NULL,
    description TEXT,
    severity VARCHAR(50) DEFAULT 'HIGH',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(255),
    snapshot_path VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS layouts (
    id SERIAL PRIMARY KEY,
    floor_num INT UNIQUE NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    width INT DEFAULT 1920,
    height INT DEFAULT 1080
);

INSERT INTO layouts (floor_num, image_path, width, height) VALUES 
(1, '/assets/layouts/floor1.png', 1920, 1080) ON CONFLICT DO NOTHING;

INSERT INTO cameras (name, rtsp_url, location, floor, x_coord, y_coord, status) VALUES
('Entry Gate 1', 'rtsp://mock-cam-1:554/stream1', 'Arrival Gate 1', 1, 150.0, 320.0, 'ACTIVE'),
('Duty Free Corridor', 'rtsp://mock-cam-2:554/stream1', 'Central Duty Free', 1, 480.0, 200.0, 'ACTIVE'),
('Rest Area Main', 'rtsp://mock-cam-3:554/stream1', 'Security Lounge', 1, 800.0, 520.0, 'ACTIVE')
ON CONFLICT DO NOTHING;
