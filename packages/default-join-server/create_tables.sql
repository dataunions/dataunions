USE `join-server-test`;

CREATE TABLE `data_union_secret` (
  `secret` varchar(255) NOT NULL,
  `dataUnion` varchar(255) NOT NULL,
  `chain` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`secret`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;