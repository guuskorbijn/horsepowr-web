"""A Polar-Flow-style TCX of a 75-minute eventing competition day (synthetic).

Shape follows Polar Flow's TCX export: default-namespace TPX extension,
Creator xsi:type="Device_t", Lap summary fields, SensorState. Data: walk
warm-up, trot/canter warm-up, cross-country at 8-10 m/s with fences, walk
recovery; one 45 s BLE dropout; GPS jitter; HR lagging the effort.
"""
import datetime, math, random, sys
random.seed(7)
out = sys.argv[1]
start = datetime.datetime(2026, 10, 25, 9, 30, 0, tzinfo=datetime.timezone.utc)  # 10:30 CET, day of DST end
phases = [  # (seconds, speed m/s, target HR)
    (900, 1.6, 80), (600, 3.8, 120), (420, 5.5, 150), (300, 1.5, 100),
    (480, 9.0, 195), (60, 6.0, 185), (1740, 1.4, 90),
]
lat, lng = 51.5719, 4.7683  # around Breda
heading = 0.3
hr = 70.0
t = 0
pts = []
dist = 0.0
max_speed = 0
hrs = []
for dur, speed, target in phases:
    for _ in range(dur):
        s = max(0.0, speed + random.gauss(0, 0.25))
        heading += random.gauss(0, 0.05)
        dlat = s * math.cos(heading) / 111_320
        dlng = s * math.sin(heading) / (111_320 * math.cos(math.radians(lat)))
        lat += dlat; lng += dlng; dist += s
        hr += (target - hr) * 0.04 + random.gauss(0, 1.2)
        max_speed = max(max_speed, s)
        jit_lat = lat + random.gauss(0, 0.000015); jit_lng = lng + random.gauss(0, 0.000015)
        alt = 4 + 6 * math.sin(t / 600)
        ts = (start + datetime.timedelta(seconds=t)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
        dropout = 2400 <= t < 2445
        hr_xml = '' if dropout else f'<HeartRateBpm><Value>{int(round(hr))}</Value></HeartRateBpm>'
        if not dropout: hrs.append(hr)
        pts.append(f'<Trackpoint><Time>{ts}</Time><Position><LatitudeDegrees>{jit_lat:.7f}</LatitudeDegrees><LongitudeDegrees>{jit_lng:.7f}</LongitudeDegrees></Position><AltitudeMeters>{alt:.1f}</AltitudeMeters><DistanceMeters>{dist:.1f}</DistanceMeters>{hr_xml}<SensorState>Present</SensorState><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Speed>{s:.3f}</Speed></TPX></Extensions></Trackpoint>')
        t += 1
total = t
xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
<Activities>
<Activity Sport="Other">
<Id>{start.strftime('%Y-%m-%dT%H:%M:%S.000Z')}</Id>
<Lap StartTime="{start.strftime('%Y-%m-%dT%H:%M:%S.000Z')}">
<TotalTimeSeconds>{total:.1f}</TotalTimeSeconds>
<DistanceMeters>{dist:.1f}</DistanceMeters>
<MaximumSpeed>{max_speed:.3f}</MaximumSpeed>
<Calories>0</Calories>
<AverageHeartRateBpm><Value>{int(sum(hrs)/len(hrs))}</Value></AverageHeartRateBpm>
<MaximumHeartRateBpm><Value>{int(max(hrs))}</Value></MaximumHeartRateBpm>
<Intensity>Active</Intensity>
<TriggerMethod>Manual</TriggerMethod>
<Track>
{chr(10).join(pts)}
</Track>
</Lap>
<Creator xsi:type="Device_t"><Name>Polar Vantage V3</Name><UnitId>0</UnitId><ProductID>0</ProductID></Creator>
</Activity>
</Activities>
<Author xsi:type="Application_t"><Name>Polar Flow</Name></Author>
</TrainingCenterDatabase>
'''
open(out, 'w').write(xml)
print(f'{out}: {total}s, {dist/1000:.2f} km, avg HR {sum(hrs)/len(hrs):.0f}, peak {max(hrs):.0f}, max speed {max_speed*3.6:.1f} km/h, {len(pts)} points')
