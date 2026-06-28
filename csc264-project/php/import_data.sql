-- =====================================================
-- ROOM BOOKING SYSTEM — DATA IMPORT (INSERT ONLY)
-- Tables must already exist (run db.sql first for schema).
-- Re-runnable: clears the listed tables, then re-inserts.
-- Generated 2026-06-21 15:45 from the live database.
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM `notification`;
DELETE FROM `payment`;
DELETE FROM `space_reservation`;
DELETE FROM `reservation`;
DELETE FROM `staff`;
DELETE FROM `student`;
DELETE FROM `space`;
DELETE FROM `user`;

-- user (4 rows)
INSERT INTO `user` (`user_id`,`name`,`email`,`password`,`contact_no`,`campus`,`user_category`,`status`,`created_at`,`updated_at`) VALUES
('1','NURSYALIN BINTI MOHAMED BAKRI','nursyalin@uitm.edu.my','$2y$10$zkuye7Xy0Lbh12irp0Tbh.685XBIl0ecqIdwKK.aJVOm0XgGgNqLy','0123456789','UITM Kampus Tapah','Staff','Active','2026-06-05 07:33:19','2026-06-05 07:34:16'),
('2','MIOR MUHAMMAD FAIZ BIN RAIYANI','mior@uitm.edu.my','$2y$10$OXMnNfpfDIJKZ.UfqDnaZOsR2rxP6dDwjT6ccxTBPIRSXPw0.I9gm','0123456790','UITM Kampus Tapah','Staff','Active','2026-06-05 07:33:19','2026-06-19 08:54:06'),
('3','SYSTEM ADMIN','admin@bsu.uitm.edu.my','$2y$10$O7F6ThHvgS9j8yGMJdBdLeqCJ6lJ8wxdgulgWsG0l5Oei3JXjXjki',NULL,'UITM Kampus Tapah','Admin','Active','2026-06-05 07:33:19','2026-06-05 07:34:16'),
('4','AHMAD NAJHAN BIN KHAIRMAN','2024220654@student.uitm.edu.my','$2y$10$bCyGYKM8YEE5ByYPxjaoa.3GtCPAAZbjiVT5kLKMKs6LJZpDJLb0u','0104503678','UITM Kampus Tapah','Student','Active','2026-06-05 07:33:19','2026-06-05 07:34:16');

-- space (15 rows)
INSERT INTO `space` (`space_id`,`space_code`,`space_name`,`moderator`,`PIC`,`space_category`,`faculty`,`campus`,`operation_time`,`seating_capacity`,`hourly_rate`,`rate_4hour`,`rate_full_day`,`facilities_list`,`remark`,`additional_info`,`terms_conditions`,`image_url`,`is_active`,`created_at`,`updated_at`) VALUES
('1','BK 01','BK 01 - Blok A','','','BILIK KULIAH','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','60','10.00','34.00','63.00','Whiteboard, Projector LCD, Aircond, Mic, 60 chairs','Booking dibenarkan untuk kuliah dan tutorial.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/lecture_room.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('3','BK 03','BK 03 - Blok A',NULL,NULL,'BILIK KULIAH','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','80','12.00','40.80','75.60','Whiteboard, Projector LCD, Aircond, PA System, 80 chairs','Kuliah dan ujian.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/lecture_room.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('4','BK 10','BK 10 - Bangunan Zeta',NULL,NULL,'BILIK KULIAH','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','50','10.00','34.00','63.00','Whiteboard, Projector LCD, Aircond, 50 chairs','Tertakluk kepada jadual akademik.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/lecture_room.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('5','BK 11','BK 11 - Bangunan Zeta',NULL,NULL,'BILIK KULIAH','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','50','10.00','34.00','63.00','Whiteboard, Projector LCD, Aircond, 50 chairs','Tertakluk kepada jadual akademik.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/lecture_room.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('7','FSKM BK 01','FSKM BK 01 - Fakulti Sains Komputer & Matematik',NULL,NULL,'BILIK KULIAH','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','50','10.00','34.00','63.00','Whiteboard, Projector, Aircond, 50 chairs','Diutamakan untuk pelajar FSKM.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/lecture_room.svg','1','2026-06-05 07:33:19','2026-06-19 01:12:00'),
('16','MK 01','Makmal Komputer 1 (FSKM)',NULL,NULL,'MAKMAL KOMPUTER','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','40','15.00','51.00','94.50','40 workstations (Intel i5, 16GB RAM), Aircond, Projector, Whiteboard','Diutamakan untuk kelas pengaturcaraan.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/computer_lab.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('18','MK 03','Makmal Komputer Multimedia',NULL,NULL,'MAKMAL KOMPUTER','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','30','20.00','68.00','126.00','30 iMacs, Adobe Creative Suite, Aircond, Projector, Studio mic','Sesuai untuk kerja multimedia dan editing.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/multimedia_lab.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('19','MK 04','Makmal Rangkaian (Networking)',NULL,NULL,'MAKMAL KOMPUTER','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','24','18.00','61.20','113.40','24 workstations, Cisco routers/switches, Patch panel, Aircond','Khas untuk subjek rangkaian.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/networking_lab.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('21','GYM 01','Gimnasium UiTM Tapah',NULL,NULL,'GIMNASIUM','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','50','8.00','27.20','50.40','Treadmill x6, Free weights, Cardio area, Lockers, Aircond','Buka 6:00am - 10:00pm. Locker dipinjam.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/gymnasium.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('22','SUR 01','Surau UiTM Tapah',NULL,NULL,'SURAU','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','100','0.00','0.00','0.00','Air-conditioned, Tempat wuduk, Telekung, Bilik kaunseling','Tiada bayaran. Dibuka 24 jam.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/surau.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('23','GLG 01','Gelanggang Futsal (Outdoor)',NULL,NULL,'GELANGGANG','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','14','20.00','68.00','126.00','AstroTurf, Lighting, Goal posts, Spectator seats','Slot 1 jam sahaja per tempahan.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/futsal_court.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('24','GLG 02','Gelanggang Bola Keranjang',NULL,NULL,'GELANGGANG','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','10','18.00','61.20','113.40','Indoor court, Score board, Lighting, Spectator seats','Slot 1 jam.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/basketball_court.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('25','GLG 03','Gelanggang Bola Tampar',NULL,NULL,'GELANGGANG','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','12','18.00','61.20','113.40','Net, Court markings, Lighting, Spectator seats','Slot 1 jam.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/volleyball_court.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('28','PAD 01','Padang Utama UiTM Tapah',NULL,NULL,'PADANG','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','300','50.00','170.00','315.00','Grass field, Track lap 400m, Goalposts, Floodlights','Untuk acara sukan besar.','GUESTS PARKING:\n50+ slot tersedia di tepi padang.\n\nNOTA:\nAcara luar tertakluk kepada kelulusan keselamatan kampus.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/field.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30'),
('29','LIB 01','Bilik Perbincangan Perpustakaan',NULL,NULL,'BILIK SEMINAR','UITM CAWANGAN PERAK','UITM Kampus Tapah','08:00 - 18:00','8','5.00','17.00','31.50','Whiteboard, TV display, WiFi, Aircond','Tempahan untuk pelajar UiTM sahaja.','GUESTS PARKING:\nParking tersedia di kawasan utama kampus.\n\nNOTA:\nSila bawa kad pelajar/staf untuk pengesahan semasa penggunaan ruang.','Sila patuhi syarat tempahan UiTM Tapah:\n- Tempahan kemudahan tertakluk kepada kelulusan moderator.\n- Pengguna bertanggungjawab terhadap sebarang kerosakan.\n- Pembatalan mesti dibuat 2 hari sebelum tarikh tempahan.','../assets/rooms/library_discussion.svg','1','2026-06-05 07:33:19','2026-06-19 01:10:30');

-- student (1 rows)
INSERT INTO `student` (`user_id`,`student_no`,`department`,`program`) VALUES
('4','2024220654','KOLEJ PENGAJIAN PENGKOMPUTERAN, INFORMATIK DAN MATEMATIK','DIPLOMA SAINS KOMPUTER');

-- staff (3 rows)
INSERT INTO `staff` (`user_id`,`staff_no`,`position`,`permission`) VALUES
('1','054067048','Space Moderator','Moderator'),
('2','054067049','Space Moderator','Moderator'),
('3','ADMIN001','System Administrator','Admin');

-- reservation (17 rows)
INSERT INTO `reservation` (`reservation_id`,`user_id`,`event`,`reservation_title`,`no_participants`,`start_date`,`end_date`,`start_time`,`end_time`,`apply_date`,`file_attachment`,`created_at`,`updated_at`) VALUES
('1','4','test','test','30','2026-06-07','2026-06-07','09:00:00','13:00:00','2026-06-05',NULL,'2026-06-05 07:36:38','2026-06-05 07:36:38'),
('2','4','meeting','Recordd KIAR','10','2026-06-07','2026-06-07','14:00:00','17:00:00','2026-06-05',NULL,'2026-06-05 08:05:09','2026-06-05 08:05:09'),
('3','4','Dinner Disk','Dinner Disk','10','2026-06-09','2026-06-09','10:00:00','12:00:00','2026-06-05',NULL,'2026-06-05 08:15:44','2026-06-05 08:15:44'),
('5','4','Record KIAR','Record KIAR','20','2026-06-08','2026-06-08','10:30:00','14:00:00','2026-06-05',NULL,'2026-06-05 08:19:41','2026-06-05 08:19:41'),
('6','4','dinner','dinner','40','2026-06-07','2026-06-07','11:00:00','18:00:00','2026-06-05',NULL,'2026-06-05 08:57:40','2026-06-05 08:57:40'),
('7','4','test','test','20','2026-06-08','2026-06-08','10:00:00','14:30:00','2026-06-05',NULL,'2026-06-05 09:11:37','2026-06-05 09:11:37'),
('8','4','Training Kesum','Kesum','250','2026-06-12','2026-06-12','08:00:00','17:00:00','2026-06-10',NULL,'2026-06-10 12:39:18','2026-06-10 12:39:18'),
('11','4','meeitng','xtay','10','2026-06-19','2026-06-19','09:00:00','13:00:00','2026-06-17',NULL,'2026-06-17 21:42:50','2026-06-17 21:42:50'),
('12','4','meeting','skill test','20','2026-06-20','2026-06-20','09:00:00','12:30:00','2026-06-17',NULL,'2026-06-18 01:11:12','2026-06-18 01:11:12'),
('13','4','exam','skill test','10','2026-06-20','2026-06-20','09:00:00','12:30:00','2026-06-17',NULL,'2026-06-18 01:15:50','2026-06-18 01:15:50'),
('14','4','test','test','20','2026-06-19','2026-06-19','14:00:00','15:00:00','2026-06-18',NULL,'2026-06-18 19:26:43','2026-06-18 19:26:43'),
('15','4','yy7y87y7y7888888888888888888888888888888888ynigga','yy7y87y7y7888888888888888888888888888888888ynigga','20','2026-06-19','2026-06-19','16:00:00','17:00:00','2026-06-18',NULL,'2026-06-18 19:31:16','2026-06-18 19:31:16'),
('16','4','yuttlhbjk','yuttlhbjk','10','2026-06-19','2026-06-19','11:00:00','11:30:00','2026-06-18',NULL,'2026-06-18 19:42:25','2026-06-18 19:42:25'),
('19','4','JHB','JHB','34','2026-06-21','2026-06-21','09:00:00','09:30:00','2026-06-18',NULL,'2026-06-18 21:32:37','2026-06-18 21:32:37'),
('20','3','KJSG','KJSG','20','2026-06-21','2026-06-21','11:30:00','12:00:00','2026-06-18',NULL,'2026-06-18 21:38:10','2026-06-18 21:38:10'),
('21','4','sadf','sadf','14','2026-06-21','2026-06-21','09:00:00','09:30:00','2026-06-18',NULL,'2026-06-19 00:22:53','2026-06-19 00:22:53'),
('22','4','main bola ramai ramai','main bola ramai ramai','10','2026-06-20','2026-06-20','10:00:00','11:30:00','2026-06-19',NULL,'2026-06-19 09:02:04','2026-06-19 09:02:04');

-- space_reservation (15 rows)
INSERT INTO `space_reservation` (`space_id`,`reservation_id`,`status`,`approval_date`,`reviewed_by`,`review_notes`) VALUES
('1','1','Pending',NULL,NULL,NULL),
('1','2','Pending',NULL,NULL,NULL),
('1','11','Pending',NULL,NULL,NULL),
('1','12','Pending',NULL,NULL,NULL),
('1','14','Approved','2026-06-18 19:57:17','3',''),
('1','15','Cancelled','2026-06-18 20:01:37','3',''),
('1','20','Cancelled','2026-06-19 09:05:31','3',''),
('1','21','Rejected','2026-06-19 09:05:17','3','need improvement'),
('3','5','Approved','2026-06-10 12:55:05','3',''),
('3','13','Rejected','2026-06-18 21:02:03','1','nanan'),
('3','19','Pending',NULL,NULL,NULL),
('4','6','Approved','2026-06-10 12:45:24','3',''),
('5','3','Approved','2026-06-05 08:21:10','3',''),
('24','22','Approved','2026-06-19 09:04:41','3',''),
('28','8','Cancelled','2026-06-10 12:54:10','3','');

-- payment (14 rows)
INSERT INTO `payment` (`payment_id`,`reservation_id`,`user_id`,`amount`,`method`,`bank_name`,`card_last4`,`bill_code`,`reference_no`,`status`,`paid_at`,`created_at`) VALUES
('2','5','4','42.00','Card',NULL,NULL,NULL,'BSU20260605021942955D2','Paid','2026-06-05 02:19:42','2026-06-05 08:19:42'),
('3','6','4','64.00','FPX','Bank Islam',NULL,NULL,'BSU202606050258132EC98','Paid','2026-06-05 02:58:13','2026-06-05 08:58:13'),
('4','7','4','39.00','FPX','Maybank2u',NULL,NULL,'BSU2026060503120026921','Paid','2026-06-05 03:12:00','2026-06-05 09:12:00'),
('5','8','4','315.00','FPX','Maybank2u',NULL,NULL,'BSU20260610063924A63E3','Paid','2026-06-10 06:39:24','2026-06-10 12:39:24'),
('6','11','4','34.00','FPX','Maybank2u',NULL,NULL,'BSU202606171543134C3D8','Paid','2026-06-17 15:43:13','2026-06-17 21:43:13'),
('7','12','4','35.00','FPX',NULL,NULL,'rxaeisfk','BSU202606171911121DC07','Pending',NULL,'2026-06-18 01:11:12'),
('8','13','4','42.00','FPX',NULL,NULL,'4tplxdp5','BSU202606171915502CEED','Pending',NULL,'2026-06-18 01:15:50'),
('9','14','4','10.00','FPX',NULL,NULL,'14exxa3h','BSU202606181326430FBC3','Pending',NULL,'2026-06-18 19:26:43'),
('10','15','4','10.00','FPX',NULL,NULL,'1mkoo2ku','BSU2026061813311633313','Pending',NULL,'2026-06-18 19:31:16'),
('11','16','4','9.00','FPX',NULL,NULL,NULL,'BSU202606181342255D8AF','Pending',NULL,'2026-06-18 19:42:25'),
('13','19','4','6.00','FPX',NULL,NULL,'yekengn1','RBS20260618153237DF68F','Pending',NULL,'2026-06-18 21:32:37'),
('14','20','3','0.00','FPX',NULL,NULL,NULL,'RBS20260618153810F9289','Paid','2026-06-18 15:38:10','2026-06-18 21:38:10'),
('15','21','4','5.00','FPX',NULL,NULL,'xd1rp95d','RBS20260618182253C9F79','Paid','2026-06-19 00:25:19','2026-06-19 00:22:53'),
('16','22','4','27.00','FPX',NULL,NULL,'c8f3lugy','RBS202606190302043AB17','Failed',NULL,'2026-06-19 09:02:04');

-- notification (9 rows)
INSERT INTO `notification` (`notification_id`,`user_id`,`type`,`title`,`message`,`related_table`,`related_id`,`is_read`,`created_at`,`read_at`) VALUES
('4','4','approval','✓ Booking Approved','Your booking \'Record KIAR\' at BK 03 - Blok A on 2026-06-08 has been approved.','reservation','5','1','2026-06-10 12:55:06','2026-06-18 19:42:55'),
('5','4','approval','✓ Booking Approved','Your booking \'Approve Flow Test\' at Padang Utama UiTM Tapah on 2026-06-15 has been approved. Notes: Approved in test','reservation','9','1','2026-06-10 12:57:14','2026-06-10 13:10:46'),
('6','4','approval','✓ Booking Approved','Your booking \'yuttlhbjk\' at Bilik Mesyuarat Akademik on 2026-06-19 has been approved.','reservation','16','1','2026-06-18 19:56:42','2026-06-19 00:48:28'),
('7','4','approval','✓ Booking Approved','Your booking \'yy7y87y7y7888888888888888888888888888888888ynigga\' at BK 01 - Blok A on 2026-06-19 has been approved.','reservation','15','1','2026-06-18 19:56:54','2026-06-19 00:48:28'),
('8','4','approval','✓ Booking Approved','Your booking \'test\' at BK 01 - Blok A on 2026-06-19 has been approved.','reservation','14','1','2026-06-18 19:57:18','2026-06-19 00:48:28'),
('9','4','rejection','✗ Booking Rejected','Your booking \'exam\' at BK 03 - Blok A on 2026-06-20 has been rejected. Reason: nanan','reservation','13','1','2026-06-18 21:02:04','2026-06-19 00:48:28'),
('10','3','approval','✓ Booking Approved','Your booking \'KJSG\' at BK 01 - Blok A on 2026-06-21 has been approved.','reservation','20','0','2026-06-19 00:03:18',NULL),
('11','4','approval','✓ Booking Approved','Your booking \'main bola ramai ramai\' at Gelanggang Bola Keranjang on 2026-06-20 has been approved.','reservation','22','0','2026-06-19 09:04:42',NULL),
('12','4','rejection','✗ Booking Rejected','Your booking \'sadf\' at BK 01 - Blok A on 2026-06-21 has been rejected. Reason: need improvement','reservation','21','0','2026-06-19 09:05:18',NULL);

SET FOREIGN_KEY_CHECKS = 1;
