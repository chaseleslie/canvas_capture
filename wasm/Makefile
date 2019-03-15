CXX := g++-7
CXX_FLAGS := -Wall -std=c++14 -I/home/sigma/Scripts/webext/canvas/lib/libwebm/include -fdiagnostics-color

MKV_LIB_WASM := -L/home/sigma/Scripts/webext/canvas/lib/libwebm/lib
EMCC_FLAGS := -Os -s RESERVED_FUNCTION_POINTERS=20 -s WASM=1 \
	-s EXPORTED_FUNCTIONS="['_webm_muxer']" \
	-s EXTRA_EXPORTED_RUNTIME_METHODS="['addFunction', 'ccall', 'getValue', 'setValue']" \
	-s NO_EXIT_RUNTIME=1 -s ALLOW_MEMORY_GROWTH=1 -s TOTAL_MEMORY=52428800

all: wasm

wasm: main.cpp muxer.h muxer.cpp
	em++ $(CXX_FLAGS) $(EMCC_FLAGS) -o build/webm_muxer.js main.cpp muxer.cpp $(MKV_LIB_WASM) -lwebm

wasm-dbg: main.cpp muxer.h muxer.cpp
	em++ $(CXX_FLAGS) $(EMCC_FLAGS) -g4 -o dbg/webm_muxer.js main.cpp muxer.cpp $(MKV_LIB_WASM) -lwebm
