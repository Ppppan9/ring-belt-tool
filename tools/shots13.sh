set -e; cd /workspace/ring-belt; F=jiehuan_chuansongdai_phase15.html; S=screenshots
node tools/shot13.mjs $F jade 1 $S/p15_jade_L1.png &
node tools/shot13.mjs $F jade 10 $S/p15_jade_mid.png &
node tools/shot13.mjs $F jade 20 $S/p15_jade_L20.png &
wait
node tools/shot13.mjs $F jade 3 $S/p15_barrier_L3.png &
node tools/shot13.mjs $F jade 12 $S/p15_barrier_L12.png &
node tools/shot13.mjs $F jade 1 $S/p15_belt_before.png &
wait
node tools/shot13.mjs $F jade 1 $S/p15_belt_after_sliders.png '{"beltFaceHue":-60,"beltFaceSat":1.6,"beltFaceBright":1.25,"beltFaceContrast":1.3}' &
node tools/shot13.mjs $F default 12 $S/p15_default_L12.png &
wait
